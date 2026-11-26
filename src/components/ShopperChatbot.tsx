import { useEffect, useRef, useState, type FormEvent } from 'react';
import { PRODUCTS, type CartItem, type Product } from '../data/catalog';
import { StoreImage } from './StoreImage';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  suggestedProducts?: Product[];
}

interface ShopperChatbotProps {
  deliveryLocation: string;
  cart: CartItem[];
  isCartOpen: boolean;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
}

const STARTER_PROMPTS = [
  "What's on deal today?",
  'Check Sony headphones stock',
  'Delivery slots in Singapore?',
  'Gift ideas under S$60',
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'Hi! I am your Amazon.sg Live Shopper Assistant. Ask me about product prices, stock availability, Prime delivery slots, or gift recommendations.',
};

export function ShopperChatbot({
  deliveryLocation,
  cart,
  isCartOpen,
  onOpenProduct,
  onAddToCart,
}: ShopperChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setErrorMsg(null);
    setLoading(true);

    const apiHistory = nextHistory
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    const cartSummary = cart
      .map((item) => {
        const product = PRODUCTS.find((p) => p.id === item.productId);
        return product ? { title: product.title, quantity: item.quantity } : null;
      })
      .filter((entry): entry is { title: string; quantity: number } => Boolean(entry));

    try {
      const res = await fetch('/api/shopper-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiHistory,
          deliveryLocation,
          cartSummary,
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        suggestedProductIds?: string[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Could not reach the live assistant.');
      }

      const suggestedProducts = (data.suggestedProductIds ?? [])
        .map((id) => PRODUCTS.find((p) => p.id === id))
        .filter((p): p is Product => Boolean(p));

      const assistantMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply || 'Here is what I found for you on Amazon.sg.',
        suggestedProducts,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to connect right now.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleQuickAdd = (product: Product) => {
    onAddToCart(product);
    setAddedId(product.id);
    window.setTimeout(() => {
      setAddedId((prev) => (prev === product.id ? null : prev));
    }, 1200);
  };

  const positionClass = isCartOpen ? 'bottom-5 right-5 lg:right-[440px]' : 'bottom-5 right-5';

  return (
    <div className={`fixed ${positionClass} z-40 transition-all duration-200`}>
      {!isOpen ? (
        <button
          id="live-chatbot-toggle"
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Amazon.sg Live Shopper Chat"
          className="bg-primary text-on-primary hover:bg-primary-container border border-accent/60 shadow-xl rounded-full px-4 py-3 flex items-center gap-2.5 cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <span className="relative flex items-center justify-center">
            <span className="material-symbols-outlined text-headline-sm text-accent" aria-hidden="true">
              support_agent
            </span>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-primary" />
          </span>
          <span className="font-label text-label-lg whitespace-nowrap">Live Shopper Chat</span>
        </button>
      ) : (
        <section
          aria-label="Amazon.sg Live Shopper Chatbot"
          className="bg-surface-card text-on-surface-card w-[calc(100vw-2.5rem)] sm:w-[380px] h-[480px] max-h-[75vh] rounded-sm shadow-2xl border border-outline flex flex-col overflow-hidden"
        >
          {/* Chat Header */}
          <div className="bg-primary text-on-primary px-4 py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-title-md text-accent shrink-0" aria-hidden="true">
                support_agent
              </span>
              <div className="min-w-0">
                <h2 className="font-headline text-title-md leading-tight truncate">
                  Amazon.sg Live Help
                </h2>
                <div className="flex items-center gap-1.5 text-label-sm text-outline">
                  <span className="w-2 h-2 rounded-full bg-success shrink-0" aria-hidden="true" />
                  <span>Online · Instant shopper queries</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setMessages([WELCOME_MESSAGE]);
                  setErrorMsg(null);
                }}
                aria-label="Clear chat conversation"
                title="Reset chat"
                className="w-8 h-8 rounded-sm hover:bg-primary-container flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-body-md">refresh</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize live chat"
                className="w-8 h-8 rounded-sm hover:bg-primary-container flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-title-md">close</span>
              </button>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-3.5 bg-surface-subtle flex flex-col gap-3"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-sm px-3 py-2 font-body text-body-sm shadow-xs ${
                    msg.role === 'user'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-card text-on-surface-card border border-outline'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>

                {msg.suggestedProducts && msg.suggestedProducts.length > 0 && (
                  <div className="w-full max-w-[92%] flex flex-col gap-1.5">
                    {msg.suggestedProducts.map((product) => {
                      const isAdded = addedId === product.id;
                      return (
                        <div
                          key={product.id}
                          className="bg-surface-card border border-outline rounded-sm p-2 flex items-center gap-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => onOpenProduct(product)}
                            className="w-11 h-11 bg-surface-subtle rounded-sm p-1 shrink-0 flex items-center justify-center cursor-pointer"
                          >
                            <StoreImage
                              src={product.image}
                              alt={product.imageAlt}
                              className="w-full h-full object-contain"
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenProduct(product)}
                              className="font-body text-label-sm font-semibold text-on-surface-card line-clamp-1 text-left hover:text-secondary cursor-pointer"
                            >
                              {product.title}
                            </button>
                            <div className="flex items-center gap-2 text-label-sm tabular-nums">
                              <span className="font-headline text-on-surface-card">
                                S${product.price.toFixed(2)}
                              </span>
                              <span className={product.stockLeft <= 10 ? 'text-deal-red' : 'text-success'}>
                                {product.stockLeft} left
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickAdd(product)}
                            className={`shrink-0 font-label text-label-sm px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                              isAdded
                                ? 'bg-success text-on-success'
                                : 'bg-tertiary text-on-tertiary hover:bg-accent'
                            }`}
                          >
                            {isAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="px-2.5 py-1 bg-surface-card border border-outline hover:border-secondary rounded-full font-body text-label-sm text-secondary cursor-pointer transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex items-start">
                <div className="bg-surface-card border border-outline rounded-sm px-3 py-2 font-body text-body-sm text-on-surface-muted flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span>Checking Amazon.sg catalog...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="bg-deal-red/5 border border-deal-red/30 text-deal-red rounded-sm px-3 py-2 font-body text-label-sm flex items-center justify-between gap-2"
              >
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => {
                    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
                    if (lastUser) void sendMessage(lastUser.text);
                  }}
                  className="font-label underline shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-outline bg-surface-card p-2.5 flex items-center gap-2 shrink-0"
          >
            <label htmlFor="shopper-chat-input" className="sr-only">
              Ask a shopping question
            </label>
            <input
              id="shopper-chat-input"
              type="text"
              maxLength={600}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, stock, or delivery..."
              className="flex-1 min-w-0 bg-surface-subtle border border-outline rounded-sm px-3 py-2 font-body text-body-sm focus:outline-none focus:border-secondary focus:bg-surface-card"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="bg-tertiary text-on-tertiary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-title-md">send</span>
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
