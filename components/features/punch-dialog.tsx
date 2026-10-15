"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, CheckCircle2Icon, LoaderIcon, MapPinIcon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PunchPayload = {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  photo?: string;
};

type Position = { latitude: number; longitude: number; accuracy: number };

// Collects the proof a company asks for at check-in or check-out: the
// browser's location and/or a selfie from the camera, then hands it to
// `onSubmit`, which returns an error message to show or null when it worked.
export function PunchDialog({
  open,
  kind,
  requireLocation,
  requirePhoto,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  kind: "check-in" | "check-out";
  requireLocation: boolean;
  requirePhoto: boolean;
  onCancel: () => void;
  onSubmit: (payload: PunchPayload) => Promise<string | null>;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const [locationError, setLocationError] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setPhoto(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setCameraReady(true);
    } catch {
      setCameraError("Could not open the camera. Allow camera access in your browser and try again.");
    }
  }, []);

  const locate = useCallback(() => {
    setLocationError("");
    setPosition(null);

    if (!navigator.geolocation) {
      setLocationError("This browser cannot share its location.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (result) =>
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        }),
      () => setLocationError("Could not get your location. Allow location access in your browser and try again."),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    if (!open) return;

    setError("");
    setSubmitting(false);

    if (requireLocation) locate();
    if (requirePhoto) void startCamera();

    return stopCamera;
  }, [open, requireLocation, requirePhoto, locate, startCamera, stopCamera]);

  function takePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth) return;

    const width = 320;
    const height = Math.round((video.videoHeight / video.videoWidth) * width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);

    setPhoto(canvas.toDataURL("image/jpeg", 0.7));
    stopCamera();
  }

  async function confirm() {
    setSubmitting(true);
    setError("");

    const message = await onSubmit({
      ...(requireLocation && position
        ? { latitude: position.latitude, longitude: position.longitude, accuracy: position.accuracy }
        : {}),
      ...(requirePhoto && photo ? { photo } : {}),
    });

    if (message) {
      setError(message);
      setSubmitting(false);
    }
  }

  const ready = (!requireLocation || position !== null) && (!requirePhoto || photo !== null);
  const label = kind === "check-in" ? "Check in" : "Check out";

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>
            Your company asks for{" "}
            {[requireLocation && "your location", requirePhoto && "a selfie"].filter(Boolean).join(" and ")} when you{" "}
            {kind === "check-in" ? "check in" : "check out"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {requireLocation && (
            <div className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <MapPinIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">Location</p>
                {position ? (
                  <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2Icon className="size-4" /> Found (accurate to about {Math.round(position.accuracy)} m)
                  </p>
                ) : locationError ? (
                  <p className="text-destructive">{locationError}</p>
                ) : (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <LoaderIcon className="size-4 animate-spin" /> Finding your location…
                  </p>
                )}
              </div>
              {(locationError || position) && (
                <Button type="button" variant="ghost" size="sm" onClick={locate}>
                  <RefreshCwIcon /> Retry
                </Button>
              )}
            </div>
          )}

          {requirePhoto && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CameraIcon className="size-5 text-muted-foreground" /> Selfie
              </p>

              {cameraError ? (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                    <RefreshCwIcon /> Try again
                  </Button>
                </div>
              ) : photo ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo} alt="Your selfie" className="mx-auto max-h-56 rounded-lg" />
                  <Button type="button" variant="outline" size="sm" onClick={startCamera}>
                    <RefreshCwIcon /> Retake
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="mx-auto max-h-56 w-full rounded-lg bg-black object-cover"
                  />
                  <Button type="button" size="sm" onClick={takePhoto} disabled={!cameraReady}>
                    <CameraIcon /> Take photo
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={!ready || submitting}>
            {submitting ? "Processing…" : label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
