// Crops a picture to a centred square and shrinks it, in the browser, so a
// 12 MP phone photo becomes a ~20 KB profile picture before it is uploaded.
export async function resizeToSquareJpeg(file: File, size = 256): Promise<Blob> {
  const url = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("That file is not a picture this browser can read. Choose a JPG, PNG or WebP image."));
      element.src = url;
    });

    const side = Math.min(image.naturalWidth, image.naturalHeight);

    if (!side) throw new Error("That picture looks empty. Choose another one.");

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");

    if (!context) throw new Error("Could not prepare the picture. Please try again.");

    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size,
    );

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the picture. Please try again."))),
        "image/jpeg",
        0.88,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
