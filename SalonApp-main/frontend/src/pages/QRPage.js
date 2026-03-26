import { useState, useEffect } from "react";
import axios from "axios";
import { QrCode, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function QRPage() {
  const [qrData, setQrData] = useState(null);

  useEffect(() => {
    fetchQRCode();
  }, []);

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/qr-code`);
      setQrData(response.data);
    } catch (error) {
      console.error('Error fetching QR code:', error);
    }
  };

  const handleDownload = () => {
    if (qrData) {
      const link = document.createElement('a');
      link.href = qrData.qr_code;
      link.download = 'salon-booking-qr.png';
      link.click();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-obsidian relative overflow-hidden">
      <div className="grain-overlay" />
      
      <div className="relative z-10 container max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <QrCode className="w-16 h-16 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-playfair font-bold text-white mb-2">QR Code for Walk-in Booking</h1>
          <p className="text-zinc-400 uppercase tracking-wide text-sm">Scan to book instantly</p>
        </motion.div>

        {/* QR Code Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-12 text-center mx-auto max-w-md print:border-8 print:border-black"
        >
          {qrData ? (
            <>
              <h2 className="text-3xl font-playfair font-bold text-black mb-4 print:mb-6">
                The Looks Unisex Salon
              </h2>
              <img
                src={qrData.qr_code}
                alt="Booking QR Code"
                data-testid="qr-code-image"
                className="w-full h-auto mb-4"
              />
              <p className="text-black font-bold text-lg mb-2 print:text-xl">
                Scan to Book Your Token
              </p>
              <p className="text-gray-600 text-sm break-all">
                {qrData.booking_url}
              </p>
            </>
          ) : (
            <div className="py-12">
              <p className="text-black">Loading QR code...</p>
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex justify-center space-x-4 mt-8 print:hidden"
        >
          <Button
            data-testid="download-qr"
            onClick={handleDownload}
            className="bg-white text-black hover:bg-gray-200 uppercase tracking-widest font-bold px-8"
          >
            <Download className="mr-2 w-4 h-4" />
            Download
          </Button>
          <Button
            data-testid="print-qr"
            onClick={handlePrint}
            className="bg-gold text-black hover:bg-gold-hover uppercase tracking-widest font-bold px-8"
          >
            <Printer className="mr-2 w-4 h-4" />
            Print
          </Button>
        </motion.div>

        {/* Instructions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 glassmorphism rounded-xl p-8 print:hidden"
        >
          <h3 className="text-xl font-playfair font-bold text-white mb-4">Instructions</h3>
          <ul className="space-y-2 text-zinc-300">
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span>
              <span>Print this QR code and display it at your salon reception</span>
            </li>
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span>
              <span>Customers can scan it with their phone camera to book instantly</span>
            </li>
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span>
              <span>You can also display it on a tablet or screen at the entrance</span>
            </li>
            <li className="flex items-start">
              <span className="text-gold mr-2">•</span>
              <span>No app installation required - works directly in the browser</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </div>
  );
}