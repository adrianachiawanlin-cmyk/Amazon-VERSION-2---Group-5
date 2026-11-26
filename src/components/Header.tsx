import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { CATEGORY_LABELS, PRODUCTS, type CategoryId, type Product } from '../data/catalog';
import { StoreImage } from './StoreImage';

interface HeaderProps {
  deliveryLocation: string;
  searchQuery: string;
  searchCategory: CategoryId;
  activeNavCategory: CategoryId | null;
  cartCount: number;
  userName: string | null;
  language: string;
  onChangeLanguage: (lang: string) => void;
  onSubmitSearch: (query: string, category: CategoryId) => void;
  onSelectCategory: (category: CategoryId | null) => void;
  onOpenProduct: (product: Product) => void;
  onOpenMenuDrawer: () => void;
  onOpenLocationModal: () => void;
  onOpenAuthModal: () => void;
  onOpenOrdersModal: () => void;
  onOpenCartDrawer: () => void;
  onOpenPrimeModal: () => void;
}

const SUBNAV_ITEMS: { id: CategoryId; label: string; hideBelowXl?: boolean }[] = [
  { id: 'fresh', label: 'Fresh' },
  { id: 'deals', label: "Today's Deals" },
  { id: 'prime', label: 'Prime' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'computers', label: 'Computers' },
  { id: 'books', label: 'Books' },
  { id: 'toys', label: 'Toys & Games' },
  { id: 'baby', label: 'Baby' },
  { id: 'grocery', label: 'Grocery' },
  { id: 'gift-cards', label: 'Gift Cards', hideBelowXl: true },
];

const LANGUAGES = [
  { code: 'EN', label: 'English - EN' },
  { code: 'ZH', label: '中文 - ZH' },
  { code: 'MS', label: 'Bahasa Melayu - MS' },
  { code: 'TA', label: 'தமிழ் - TA' },
];

export function Header({
  deliveryLocation,
  searchQuery,
  searchCategory,
  activeNavCategory,
  cartCount,
  userName,
  language,
  onChangeLanguage,
  onSubmitSearch,
  onSelectCategory,
  onOpenProduct,
  onOpenMenuDrawer,
  onOpenLocationModal,
  onOpenAuthModal,
  onOpenOrdersModal,
  onOpenCartDrawer,
  onOpenPrimeModal,
}: HeaderProps) {
  const [draftQuery, setDraftQuery] = useState(searchQuery);
  const [draftCategory, setDraftCategory] = useState<CategoryId>(searchCategory);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target as Node)
      ) {
        setSuggestionsOpen(false);
        setHighlightedIdx(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const suggestedProducts = useMemo(() => {
    const q = draftQuery.trim().toLowerCase();
    if (!q) return [];

    const pool = PRODUCTS.filter((product) => {
      if (draftCategory !== 'all' && product.category !== draftCategory) {
        return false;
      }
      const haystack = `${product.title} ${product.brand} ${CATEGORY_LABELS[product.category]}`.toLowerCase();
      return haystack.includes(q);
    });

    return [...pool]
      .sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aStarts = aTitle.startsWith(q) || a.brand.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = bTitle.startsWith(q) || b.brand.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        const aWordStarts = aTitle.split(/\s+/).some((w) => w.startsWith(q)) ? 0 : 1;
        const bWordStarts = bTitle.split(/\s+/).some((w) => w.startsWith(q)) ? 0 : 1;
        if (aWordStarts !== bWordStarts) return aWordStarts - bWordStarts;

        return aTitle.localeCompare(bTitle);
      })
      .slice(0, 6);
  }, [draftQuery, draftCategory]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    onSubmitSearch(draftQuery.trim(), draftCategory);
  };

  const handleSelectSuggestion = (product: Product) => {
    setDraftQuery(product.title);
    setSuggestionsOpen(false);
    setHighlightedIdx(-1);
    onOpenProduct(product);
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen || suggestedProducts.length === 0) {
      if (e.key === 'Escape') {
        setSuggestionsOpen(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev + 1) % suggestedProducts.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((prev) => (prev <= 0 ? suggestedProducts.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      setSuggestionsOpen(false);
      setHighlightedIdx(-1);
    } else if (e.key === 'Enter' && highlightedIdx >= 0 && suggestedProducts[highlightedIdx]) {
      e.preventDefault();
      handleSelectSuggestion(suggestedProducts[highlightedIdx]);
    }
  };

  const renderHighlightedTitle = (title: string, query: string) => {
    const q = query.trim();
    if (!q) return title;
    const lowerTitle = title.toLowerCase();
    const matchIndex = lowerTitle.indexOf(q.toLowerCase());
    if (matchIndex === -1) return title;
    const before = title.slice(0, matchIndex);
    const match = title.slice(matchIndex, matchIndex + q.length);
    const after = title.slice(matchIndex + q.length);
    return (
      <>
        {before}
        <strong className="font-bold text-primary bg-tertiary/40 rounded-[2px] px-0.5">{match}</strong>
        {after}
      </>
    );
  };

  return (
    <header className="bg-primary text-on-primary sticky top-0 z-40">
      <div className="max-w-[1500px] mx-auto px-gutter-md py-gutter-sm flex items-center gap-gutter-md">
        {/* Amazon.sg Brand Mark */}
        <button
          type="button"
          onClick={() => {
            setDraftQuery('');
            setDraftCategory('all');
            onSelectCategory(null);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-start px-gutter-sm py-gutter-xs border border-transparent hover:border-on-primary rounded-sm shrink-0 cursor-pointer text-left"
          aria-label="Amazon.sg Home"
        >
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className="font-headline text-headline-md text-on-primary tracking-tight">
                amazon
              </span>
              <span className="font-label text-label-lg text-accent">.sg</span>
            </div>
            <svg width="74" height="10" viewBox="0 0 74 10" fill="none" aria-hidden="true" className="-mt-1">
              <path d="M4 2.5C20 9.5 48 9.5 64 3.5" stroke="#FF9900" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M61 1.5L66.5 3L63.5 8" stroke="#FF9900" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </button>

        {/* Deliver to Singapore */}
        <button
          type="button"
          onClick={onOpenLocationModal}
          className="hidden md:flex items-center gap-1 px-gutter-sm py-gutter-xs border border-transparent hover:border-on-primary rounded-sm text-left shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-title-md text-on-primary mt-2" aria-hidden="true">
            location_on
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-label text-label-sm text-outline">Deliver to</span>
            <span className="font-label text-label-lg text-on-primary whitespace-nowrap max-w-[140px] truncate">
              {deliveryLocation}
            </span>
          </div>
        </button>

        {/* Global Search Bar with Live Alphabetical Suggestions */}
        <div ref={searchWrapperRef} className="flex-1 min-w-0 relative">
          <form
            id="global-search-form"
            role="search"
            onSubmit={handleFormSubmit}
            className="flex items-stretch w-full rounded-sm overflow-hidden bg-surface-card focus-within:ring-2 focus-within:ring-accent"
          >
            <select
              id="search-category"
              aria-label="Search category"
              value={draftCategory}
              onChange={(e) => {
                setDraftCategory(e.target.value as CategoryId);
                setHighlightedIdx(-1);
              }}
              className="hidden sm:block bg-surface-subtle text-on-surface-subtle border-0 border-r border-outline font-label text-label-sm px-gutter-md py-2 focus:outline-none cursor-pointer"
            >
              <option value="all">All</option>
              <option value="electronics">Electronics</option>
              <option value="computers">Computers</option>
              <option value="books">Books</option>
              <option value="toys">Toys &amp; Games</option>
              <option value="baby">Baby</option>
              <option value="grocery">Grocery</option>
              <option value="fresh">Amazon Fresh</option>
            </select>
            <input
              id="search-input-01"
              type="search"
              autoComplete="off"
              aria-label="Search Amazon.sg"
              aria-expanded={suggestionsOpen && draftQuery.trim().length > 0}
              aria-controls="search-suggestions-listbox"
              aria-autocomplete="list"
              placeholder="Search Amazon.sg"
              value={draftQuery}
              onFocus={() => {
                if (draftQuery.trim().length > 0) setSuggestionsOpen(true);
              }}
              onChange={(e) => {
                const nextVal = e.target.value;
                setDraftQuery(nextVal);
                setHighlightedIdx(-1);
                setSuggestionsOpen(nextVal.trim().length > 0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="flex-1 min-w-0 border-0 bg-surface-card text-on-surface-card placeholder:text-on-surface-muted font-body text-body-md px-3 py-2 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="bg-search-amber text-on-search-amber hover:bg-accent px-4 flex items-center justify-center transition-colors duration-state-change cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-headline-sm">search</span>
            </button>
          </form>

          {suggestionsOpen && draftQuery.trim().length > 0 && (
            <div
              id="search-suggestions-listbox"
              role="listbox"
              aria-label="Suggested products"
              className="absolute left-0 right-0 top-full mt-1 bg-surface-card text-on-surface-card border border-outline rounded-sm shadow-xl z-50 overflow-hidden"
            >
              {suggestedProducts.length > 0 ? (
                <>
                  <div className="px-3 py-1.5 bg-surface-subtle border-b border-outline flex items-center justify-between">
                    <span className="font-label text-label-sm text-on-surface-muted">
                      Suggested products matching &ldquo;{draftQuery.trim()}&rdquo;
                    </span>
                    <span className="font-label text-label-sm text-on-surface-muted tabular-nums">
                      {suggestedProducts.length} {suggestedProducts.length === 1 ? 'match' : 'matches'}
                    </span>
                  </div>
                  <ul className="divide-y divide-outline/60 max-h-80 overflow-y-auto">
                    {suggestedProducts.map((product, index) => {
                      const isHighlighted = index === highlightedIdx;
                      return (
                        <li key={product.id} role="option" aria-selected={isHighlighted}>
                          <button
                            type="button"
                            onMouseEnter={() => setHighlightedIdx(index)}
                            onClick={() => handleSelectSuggestion(product)}
                            className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors cursor-pointer ${
                              isHighlighted ? 'bg-surface-subtle' : 'hover:bg-surface-subtle'
                            }`}
                          >
                            <div className="w-10 h-10 bg-surface-subtle rounded-sm p-1 shrink-0 flex items-center justify-center border border-outline/50">
                              <StoreImage
                                src={product.image}
                                alt={product.imageAlt}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-body text-body-sm text-on-surface-card line-clamp-1">
                                {renderHighlightedTitle(product.title, draftQuery)}
                              </p>
                              <div className="flex items-center gap-2 text-label-sm text-on-surface-muted">
                                <span>{product.brand}</span>
                                <span aria-hidden="true">·</span>
                                <span>{CATEGORY_LABELS[product.category]}</span>
                                <span aria-hidden="true">·</span>
                                <span className={product.stockLeft <= 5 ? 'text-deal-red font-medium' : 'text-success'}>
                                  {product.stockLeft} left
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right tabular-nums">
                              <span className="font-headline text-label-lg text-on-surface-card">
                                S${product.price.toLocaleString('en-SG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestionsOpen(false);
                      setHighlightedIdx(-1);
                      onSubmitSearch(draftQuery.trim(), draftCategory);
                    }}
                    className="w-full px-3 py-2 bg-surface-subtle border-t border-outline text-left font-label text-label-sm text-secondary hover:text-accent hover:bg-outline/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-body-md" aria-hidden="true">search</span>
                    <span>See all results for &ldquo;{draftQuery.trim()}&rdquo;</span>
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="font-body text-body-sm text-on-surface-muted">
                    No direct product title matches for &ldquo;{draftQuery.trim()}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestionsOpen(false);
                      onSubmitSearch(draftQuery.trim(), draftCategory);
                    }}
                    className="font-label text-label-sm text-secondary hover:underline shrink-0 cursor-pointer"
                  >
                    Search catalog
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-gutter-xs shrink-0">
          {/* Language / Region */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              aria-expanded={langMenuOpen}
              className="flex items-center gap-1 px-gutter-sm py-2 border border-transparent hover:border-on-primary rounded-sm cursor-pointer"
            >
              <span className="material-symbols-outlined text-title-md text-on-primary" aria-hidden="true">
                language
              </span>
              <span className="font-label text-label-lg text-on-primary">{language}</span>
              <span className="material-symbols-outlined text-body-sm text-outline" aria-hidden="true">
                arrow_drop_down
              </span>
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-surface-card text-on-surface-card border border-outline rounded-sm shadow-lg py-2 z-50">
                <p className="px-3 py-1 font-label text-label-sm text-on-surface-muted border-b border-outline">
                  Change language (SG)
                </p>
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      onChangeLanguage(lang.code);
                      setLangMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 font-body text-body-sm hover:bg-surface-subtle flex items-center justify-between cursor-pointer ${
                      language === lang.code ? 'font-semibold text-secondary' : ''
                    }`}
                  >
                    <span>{lang.label}</span>
                    {language === lang.code && (
                      <span className="material-symbols-outlined text-body-md text-secondary">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Account & Lists */}
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex flex-col px-gutter-sm py-gutter-xs border border-transparent hover:border-on-primary rounded-sm leading-tight text-left cursor-pointer"
          >
            <span className="font-label text-label-sm text-outline whitespace-nowrap max-w-[110px] truncate">
              {userName ? `Hello, ${userName}` : 'Hello, sign in'}
            </span>
            <div className="flex items-center">
              <span className="font-label text-label-lg text-on-primary whitespace-nowrap">Account &amp; Lists</span>
              <span className="material-symbols-outlined text-body-sm text-outline" aria-hidden="true">
                arrow_drop_down
              </span>
            </div>
          </button>

          {/* Returns & Orders */}
          <button
            type="button"
            onClick={onOpenOrdersModal}
            className="hidden md:flex flex-col px-gutter-sm py-gutter-xs border border-transparent hover:border-on-primary rounded-sm leading-tight text-left cursor-pointer"
          >
            <span className="font-label text-label-sm text-outline whitespace-nowrap">Returns</span>
            <span className="font-label text-label-lg text-on-primary whitespace-nowrap">&amp; Orders</span>
          </button>

          {/* Cart */}
          <button
            type="button"
            onClick={onOpenCartDrawer}
            aria-label={`Shopping cart with ${cartCount} items`}
            className="flex items-center gap-1 px-gutter-sm py-gutter-xs border border-transparent hover:border-on-primary rounded-sm cursor-pointer"
          >
            <div className="relative flex items-center">
              <span className="material-symbols-outlined text-headline-lg text-on-primary" aria-hidden="true">
                shopping_cart
              </span>
              <span
                id="cart-count-badge"
                role="status"
                className="absolute -top-1 -right-2 inline-flex items-center justify-center bg-accent text-on-tertiary font-label text-label-sm px-1.5 py-0 rounded-full tabular-nums min-w-[20px]"
              >
                <span className="font-label text-label-sm">{cartCount}</span>
              </span>
            </div>
            <span className="hidden sm:inline font-label text-label-lg text-on-primary mt-2">Cart</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Bar */}
      <nav aria-label="Primary categories" className="bg-primary-container text-on-primary-container">
        <div className="max-w-[1500px] mx-auto px-gutter-md py-gutter-xs flex items-center justify-between gap-gutter-md overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-gutter-xs shrink-0">
            <button
              type="button"
              onClick={onOpenMenuDrawer}
              className="flex items-center gap-1 px-gutter-sm py-1 border border-transparent hover:border-on-primary rounded-sm font-label text-label-lg cursor-pointer whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-title-md" aria-hidden="true">
                menu
              </span>
              <span className="font-label text-label-lg">All</span>
            </button>
            {SUBNAV_ITEMS.map((item) => {
              const isActive = activeNavCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectCategory(item.id)}
                  className={`${
                    item.hideBelowXl ? 'hidden xl:inline-block' : ''
                  } px-gutter-sm py-1 border rounded-sm font-body text-body-md whitespace-nowrap cursor-pointer transition-colors duration-state-change ${
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent hover:border-on-primary text-on-primary-container'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onOpenPrimeModal}
            className="hidden lg:flex items-center gap-1 px-gutter-sm py-1 border border-transparent hover:border-on-primary rounded-sm font-label text-label-sm text-accent whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="font-label text-label-sm">Free delivery on eligible orders over S$40</span>
          </button>
        </div>
      </nav>
    </header>
  );
}
