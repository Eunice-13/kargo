import { ChevronLeft, ChevronRight } from "lucide-react";

export default function BatchGallery({
  photos,
  title,
  index,
  prev,
  next,
  select,
}: {
  photos: string[];
  title: string;
  index: number;
  prev: () => void;
  next: () => void;
  select: (index: number) => void;
}) {
  const count = photos.length;
  const current = photos[index] ?? photos[0] ?? "";

  return (
    <div className="bd-gallery">
      <div className="bd-gallery__frame">
        <img className="bd-gallery__img" src={current} alt={title} />
        {count > 1 && (
          <>
            <button
              type="button"
              className="bd-gallery__arrow bd-gallery__arrow--prev"
              aria-label="Previous photo"
              onClick={prev}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="bd-gallery__arrow bd-gallery__arrow--next"
              aria-label="Next photo"
              onClick={next}
            >
              <ChevronRight size={20} />
            </button>
            <span className="bd-gallery__count">
              {index + 1}/{count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="bd-gallery__thumbs">
          {photos.map((photo, photoIndex) => (
            <button
              type="button"
              key={photo}
              className="bd-gallery__thumb"
              aria-current={photoIndex === index}
              aria-label={`Photo ${photoIndex + 1}`}
              onClick={() => select(photoIndex)}
            >
              <img src={photo} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
