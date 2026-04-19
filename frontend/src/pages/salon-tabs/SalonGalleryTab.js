import { ImageOff, Play } from 'lucide-react';
import { useState } from 'react';

const isVideo = (url) =>
  typeof url === 'string' && (url.startsWith('data:video') || /\.(mp4|webm|mov|ogg)(\?|$)/i.test(url));

export default function SalonGalleryTab({ salon }) {
  const [selected, setSelected] = useState(null);

  const items = salon.photo_gallery && salon.photo_gallery.length > 0 ? salon.photo_gallery : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-playfair font-bold text-foreground">Gallery</h2>
        <p className="text-muted-foreground">Take a look at our salon and work</p>
      </div>

      {/* Gallery Grid */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, index) => {
            const video = isVideo(item);
            return (
              <div
                key={index}
                onClick={() => setSelected(item)}
                className="aspect-square rounded-xl overflow-hidden cursor-pointer group relative bg-black"
              >
                {video ? (
                  <>
                    <video
                      src={item}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                        <Play className="w-6 h-6 text-black ml-0.5" fill="currentColor" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <img
                      src={item}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ImageOff className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No gallery media available</p>
        </div>
      )}

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            {isVideo(selected) ? (
              <video
                src={selected}
                className="max-w-full max-h-[90vh] rounded-lg w-full"
                controls
                autoPlay
              />
            ) : (
              <img
                src={selected}
                alt="Gallery"
                className="max-w-full max-h-[90vh] object-contain rounded-lg mx-auto"
              />
            )}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
