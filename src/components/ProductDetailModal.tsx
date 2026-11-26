import { useEffect, useState } from 'react';
import type { Product } from '../data/catalog';
import { StarRating } from './PopularGrid';
import { StoreImage } from './StoreImage';

interface ProductDetailModalProps {
  product: Product | null;
  deliveryLocation: string;
  isSaved: boolean;
  cartQuantity?: number;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onBuyNow: (product: Product, quantity: number) => void;
  onToggleSave: (productId: string) => void;
}

export function ProductDetailModal({
  product,
  deliveryLocation,
  isSaved,
  cartQuantity = 0,
  onClose,
  onAddToCart,
  onBuyNow,
  onToggleSave,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [viewerCount, setViewerCount] = useState(product?.activeViewers ?? 12);

  useEffect(() => {
    if (!product) return;
    setViewerCount(product.activeViewers);
    const interval = window.setInterval(() => {
      setViewerCount((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(3, Math.min(product.activeViewers + 5, prev + delta));
      });
    }, 6500);
    return () => window.clearInterval(interval);
  }, [product]);

  if (!product) return null;

  const remainingAvailable = Math.max(0, product.stockLeft - cartQuantity);
  const maxSelectable = Math.max(1, Math.min(10, remainingAvailable));
  const clampedQuantity = Math.min(quantity, maxSelectable);
  const isOutOfRemaining = remainingAvailable <= 0;
  const isLowStock = product.stockLeft <= 10;

  const handleAdd = () => {
    if (isOutOfRemaining) return;
    onAddToCart(product, clampedQuantity);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-primary/60 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="bg-surface-card text-on-surface-card max-w-4xl w-full rounded-sm shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-gutter-lg py-gutter-md border-b border-outline bg-surface-subtle">
          <span className="font-label text-label-sm text-on-surface-muted">{product.brand} Official Store</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product details"
            className="w-8 h-8 rounded-sm hover:bg-outline/40 flex items-center justify-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-title-md">close</span>
          </button>
        </div>

        <div className="overflow-y-auto p-gutter-xl grid grid-cols-1 md:grid-cols-2 gap-gutter-xl">
          {/* Left: Product Visual */}
          <div className="bg-surface-subtle rounded-sm p-6 flex items-center justify-center min-h-[280px] md:min-h-[360px]">
            <StoreImage
              src={product.image}
              alt={product.imageAlt}
              className="max-h-72 w-full object-contain"
            />
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="flex flex-col gap-gutter-md">
            <div>
              <h2 id="pdp-title" className="font-headline text-headline-md text-on-surface-card text-balance">
                {product.title}
              </h2>
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                <div className="flex items-center gap-2">
                  <StarRating rating={product.rating} />
                  <span className="font-label text-label-sm text-secondary tabular-nums">
                    {product.rating.toFixed(1)} ({product.reviewCount.toLocaleString('en-SG')} ratings)
                  </span>
                </div>
              </div>

              {/* Live shopper activity & balance stock indicators */}
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex items-center gap-1.5 bg-surface-subtle border border-outline rounded-sm px-2.5 py-1 text-on-surface-card"
                  aria-live="polite"
                >
                  <span className="w-2 h-2 rounded-full bg-deal-red animate-pulse shrink-0" aria-hidden="true" />
                  <span className="material-symbols-outlined text-body-md text-secondary" aria-hidden="true">
                    visibility
                  </span>
                  <span className="font-label text-label-sm tabular-nums">
                    <strong>{viewerCount}</strong> shoppers looking at this item now
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 border rounded-sm px-2.5 py-1 ${
                    isLowStock
                      ? 'bg-deal-red/5 border-deal-red/30 text-deal-red'
                      : 'bg-success/5 border-success/30 text-success'
                  }`}
                >
                  <span className="material-symbols-outlined text-body-md" aria-hidden="true">
                    inventory_2
                  </span>
                  <span className="font-label text-label-sm tabular-nums">
                    Balance stock left: <strong>{product.stockLeft}</strong> {product.stockLeft === 1 ? 'unit' : 'units'}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-t border-b border-outline py-gutter-md flex flex-col gap-1.5">
              {product.discountPercent && (
                <div className="flex items-center gap-2">
                  <span className="bg-deal-red text-on-deal-red font-label text-label-sm px-2 py-0.5 rounded-sm tabular-nums">
                    -{product.discountPercent}%
                  </span>
                  {product.dealLabel && (
                    <span className="font-label text-label-sm text-deal-red">{product.dealLabel}</span>
                  )}
                </div>
              )}
              <div className="flex items-baseline gap-2 tabular-nums">
                <span className="font-headline text-headline-lg text-on-surface-card">
                  S${product.price.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {product.originalPrice && (
                  <span className="font-body text-body-sm text-on-surface-muted line-through">
                    List: S${product.originalPrice.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {product.isPrime && (
                  <span className="bg-prime-blue text-on-tertiary font-label text-label-sm px-2 py-0.5 rounded-sm">
                    prime
                  </span>
                )}
                <span className="font-label text-label-sm text-success">
                  {product.deliveryText} to {deliveryLocation}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className={`font-label text-label-sm ${isLowStock ? 'text-deal-red font-semibold' : 'text-success'}`}>
                  {isLowStock
                    ? `Only ${product.stockLeft} left in stock — order soon`
                    : `In Stock (${product.stockLeft} available)`}{' '}
                  · Ships from Amazon.sg
                </span>
                {cartQuantity > 0 && (
                  <span className="font-label text-label-sm text-secondary tabular-nums">
                    ({cartQuantity} in cart · {remainingAvailable} more available)
                  </span>
                )}
              </div>
            </div>

            <p className="font-body text-body-md text-on-surface-card">{product.description}</p>

            <ul className="flex flex-col gap-1.5 font-body text-body-sm text-on-surface-muted list-disc pl-5">
              {product.highlights.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <div className="pt-gutter-sm flex flex-col gap-gutter-sm">
              <div className="flex items-center gap-3">
                <label htmlFor="pdp-qty" className="font-label text-label-sm text-on-surface-card">
                  Qty:
                </label>
                <select
                  id="pdp-qty"
                  disabled={isOutOfRemaining}
                  value={clampedQuantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="bg-surface-subtle border border-outline rounded-sm px-3 py-1.5 font-body text-body-sm tabular-nums cursor-pointer disabled:opacity-50"
                >
                  {Array.from({ length: maxSelectable }, (_, idx) => idx + 1).map((num) => (
                    <option key={num} value={num}>
                      {num}
                    </option>
                  ))}
                </select>
                {isOutOfRemaining && (
                  <span className="font-label text-label-sm text-deal-red">
                    All available stock ({product.stockLeft}) is already in your cart.
                  </span>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-gutter-sm">
                <button
                  type="button"
                  disabled={isOutOfRemaining}
                  onClick={handleAdd}
                  className={`flex-1 font-label text-label-lg py-2.5 px-5 rounded-full transition-colors duration-state-change cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    addedFeedback
                      ? 'bg-success text-on-success'
                      : 'bg-tertiary text-on-tertiary hover:bg-accent'
                  }`}
                >
                  {isOutOfRemaining ? 'Max Stock in Cart' : addedFeedback ? 'Added to Cart' : 'Add to Cart'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isOutOfRemaining) {
                      onBuyNow(product, clampedQuantity);
                    }
                    onClose();
                  }}
                  className="flex-1 bg-accent text-on-tertiary hover:bg-search-amber font-label text-label-lg py-2.5 px-5 rounded-full transition-colors duration-state-change cursor-pointer"
                >
                  {isOutOfRemaining ? 'View Cart' : 'Buy Now'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => onToggleSave(product.id)}
                className="self-start flex items-center gap-1.5 font-body text-body-sm text-secondary hover:text-accent cursor-pointer pt-1"
              >
                <span className="material-symbols-outlined text-title-md">
                  {isSaved ? 'bookmark_added' : 'bookmark_border'}
                </span>
                <span>{isSaved ? 'Saved in Your List' : 'Add to List'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
