import { connect } from "net";

// Checks on a resume before it is stored. This is not a full antivirus: it
// refuses the things a resume has no reason to contain (scripts, macros,
// embedded programs) and, when the company's host runs ClamAV, asks it too.

const EICAR = "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

// PDF names can hide letters as #xx escapes (/J#61vaScript), so undo those
// before looking for the dangerous ones.
const unescapePdfNames = (text: string) =>
  text.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

const PDF_ACTIVE = [
  "/JavaScript",
  "/JS",
  "/Launch",
  "/EmbeddedFile",
  "/RichMedia",
  "/XFA",
  "/GoToE",
  "/GoToR",
  "/ImportData",
  "/SubmitForm",
];

// Entries of a zip file (a .docx), read from its central directory without
// unpacking anything. Null when the file is not a well-formed zip.
function zipEntries(bytes: Uint8Array) {
  const buf = Buffer.from(bytes);
  let end = -1;

  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }

  if (end < 0) return null;

  const count = buf.readUInt16LE(end + 10);
  let offset = buf.readUInt32LE(end + 16);
  const entries: { name: string; size: number; compressed: number }[] = [];

  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== 0x02014b50) return null;

    const compressed = buf.readUInt32LE(offset + 20);
    const size = buf.readUInt32LE(offset + 24);
    const nameLength = buf.readUInt16LE(offset + 28);
    const extraLength = buf.readUInt16LE(offset + 30);
    const commentLength = buf.readUInt16LE(offset + 32);

    entries.push({ name: buf.toString("utf8", offset + 46, offset + 46 + nameLength), size, compressed });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// The reason a resume is refused, or null when it passes.
export function screenResume(bytes: Uint8Array, ext: string): string | null {
  const text = latin1(bytes);

  if (text.includes(EICAR)) return "The file was flagged as a virus.";

  if (ext === "pdf") {
    const names = unescapePdfNames(text);

    if (PDF_ACTIVE.some((name) => names.includes(name))) {
      return "The PDF contains scripts or embedded files. Save it again as a plain PDF.";
    }

    return null;
  }

  if (ext === "docx") {
    const entries = zipEntries(bytes);

    if (!entries) return "The file is damaged. Save it again and retry.";

    // A small file that unpacks into something huge is a zip bomb.
    const total = entries.reduce((sum, e) => sum + e.size, 0);

    if (entries.length > 2000 || total > 100 * 1024 * 1024) {
      return "The file is not a normal document.";
    }

    const bad = entries.find((e) => {
      const name = e.name.toLowerCase();

      return (
        name.includes("vbaproject") ||
        name.startsWith("word/activex") ||
        name.startsWith("word/embeddings/") ||
        /\.(exe|dll|bat|cmd|js|vbs|ps1|scr|msi|jar)$/.test(name)
      );
    });

    return bad ? "The document contains macros or embedded programs. Save it without them." : null;
  }

  if (ext === "doc") {
    // Old Word files keep macros in streams named _VBA_PROJECT / Macros,
    // stored as UTF-16 text.
    for (const marker of ["_VBA_PROJECT", "Macros", "VBA"]) {
      if (Buffer.from(bytes).includes(Buffer.from(marker, "utf16le"))) {
        return "The document contains macros. Save it without them.";
      }
    }
  }

  return null;
}

// ClamAV, when the host has one: CLAMAV_HOST (and optionally CLAMAV_PORT,
// default 3310). Uses clamd's INSTREAM command. Returns the reason to refuse,
// or null when the scan found nothing. When ClamAV is set up but cannot be
// reached the file is refused: an unscanned file is not let through quietly.
export async function scanWithClamav(bytes: Uint8Array): Promise<string | null> {
  const host = process.env.CLAMAV_HOST;

  if (!host) return null;

  const port = Number(process.env.CLAMAV_PORT ?? 3310) || 3310;

  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let reply = "";
    let settled = false;

    const done = (result: string | null) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(15_000, () => done("The file could not be checked right now. Please try again later."));
    socket.on("error", () => done("The file could not be checked right now. Please try again later."));
    socket.on("data", (chunk) => {
      reply += chunk.toString("utf8");
    });
    socket.on("close", () => {
      if (settled) return;

      if (/OK\0?\s*$/.test(reply)) done(null);
      else if (/FOUND/.test(reply)) done("The file was flagged as a virus.");
      else done("The file could not be checked right now. Please try again later.");
    });

    socket.on("connect", () => {
      socket.write("zINSTREAM\0");

      const buf = Buffer.from(bytes);

      for (let i = 0; i < buf.length; i += 64 * 1024) {
        const chunk = buf.subarray(i, i + 64 * 1024);
        const size = Buffer.alloc(4);

        size.writeUInt32BE(chunk.length);
        socket.write(size);
        socket.write(chunk);
      }

      socket.write(Buffer.alloc(4));
    });
  });
}
