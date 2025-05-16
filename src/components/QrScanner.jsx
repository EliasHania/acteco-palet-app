import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const QrScanner = ({ onScan, onClose }) => {
  const qrRef = useRef(null);
  const html5QrCode = useRef(null);
  const [isRunning, setIsRunning] = useState(false);

  const iniciarCamara = async () => {
    html5QrCode.current = new Html5Qrcode("qr-reader");

    try {
      await html5QrCode.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            return {
              width: viewfinderWidth,
              height: viewfinderHeight,
            };
          },
        },
        (decodedText) => {
          onScan(decodedText); // ✅ guarda código
          detenerCamara(); // ✅ cierra cámara tras escaneo
        }
      );

      const video = document.querySelector("#qr-reader video");
      if (video) video.setAttribute("playsinline", true);

      setIsRunning(true);
    } catch (err) {
      console.error("Error al iniciar QR:", err);
    }
  };

  const detenerCamara = async () => {
    if (html5QrCode.current) {
      await html5QrCode.current.stop().catch(() => {});
      await html5QrCode.current.clear().catch(() => {});
    }
    setIsRunning(false);
    onClose(); // ✅ notifica al padre
  };

  useEffect(() => {
    iniciarCamara();
    return () => {
      detenerCamara();
    };
  }, []);

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-md border border-indigo-200 p-2">
      <div ref={qrRef} id="qr-reader" className="w-full h-[300px]" />
    </div>
  );
};

export default QrScanner;
