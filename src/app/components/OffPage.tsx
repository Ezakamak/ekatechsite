import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { motion } from "motion/react";
import {
  Award,
  BarChart3,
  Building2,
  CircleDot,
  Club,
  Dice5,
  Gamepad2,
  Gift,
  Lock,
  Pickaxe,
  Plane,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import coinIcon from "../../imports/ekatech-coin.png";
import { useLanguage } from "../i18n";
import { TechDuelSync } from "./TechDuelSyncFixed";
import { TechDuelBotAssist } from "./TechDuelBotAssist";
import { CipherBreak } from "./CipherBreak";
import { CoreRaid } from "./CoreRaid";
import { MarketAcademy } from "./MarketAcademy";
import { MemeClicker } from "./MemeClicker";
import { TechCoinMiner } from "./TechCoinMiner";
import { DropTech } from "./DropTech";
import { TechCoinMines } from "./TechCoinMines";
import { EkaTowers } from "./EkaTowers";
import { TechAviator } from "./tech-aviator/TechAviator";
import { TechDice } from "./TechDice";
import { TechBlackjack } from "./TechBlackjack";
import { TechCoinWalletBadge } from "./TechCoinWalletBadge";
import { playOffSound } from "./OffSoundEngine";
import { OffFriendsPanel } from "./OffFriendsPanel";

const TechRoulette = lazy(() =>
  import("./TechRoulette").then((module) => ({ default: module.TechRoulette })),
);

type GameErrorBoundaryProps = {
  children: ReactNode;
  gameName: string;
  onBack: () => void;
};

type GameErrorBoundaryState = {
  hasError: boolean;
};

class GameErrorBoundary extends Component<
  GameErrorBoundaryProps,
  GameErrorBoundaryState
> {
  state: GameErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`${this.props.gameName} açılırken hata oluştu`, error, info);
  }

  componentDidUpdate(previousProps: GameErrorBoundaryProps) {
    if (this.state.hasError && previousProps.gameName !== this.props.gameName) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="relative min-h-screen bg-black px-4 pb-24 pt-32 text-white sm:px-6">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-red-300/20 bg-red-500/10 p-6 text-center shadow-2xl shadow-red-500/10 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100/70">
            Oyun yüklenemedi
          </p>
          <h1 className="mt-4 text-3xl font-semibold">
            {this.props.gameName} güvenli moda alındı.
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            Sayfanın tamamının çökmesini engelledim. Lütfen hub'a dönüp tekrar
            dene; hata devam ederse bu kart açık kalır.
          </p>
          <button
            type="button"
            onClick={this.props.onBack}
            className="mt-6 rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            Hub'a dön
          </button>
        </div>
      </main>
    );
  }
}

type User = {
  id: number;
  name: string;
  email: string;
  role?: string;
  avatar_url?: string;
};

type Wallet = {
  currency: string;
  symbol: string;
  balance: number;
  lifetime_earned: number;
  updated_at?: string | null;
  level?: LevelProgress;
};

type LevelProgress = {
  level: number;
  exp: number;
  currentLevelExp: number;
  nextLevelExp: number;
  expIntoLevel: number;
  expNeededForNext: number;
  verified: boolean;
};

type GameKey =
  | "hub"
  | "duel"
  | "cipher"
  | "raid"
  | "market"
  | "miner"
  | "droptech"
  | "mines"
  | "towers"
  | "aviator"
  | "roulette"
  | "dice"
  | "blackjack"
  | "memeClicker"
  | "store";

type TechStoreTlPackage = {
  slug: string;
  name: string;
  priceTl: string;
  techCoin: number;
  exp: number;
};

type ShopCatalogItem = {
  slug: string;
  name: string;
  emoji: string;
  description: string;
  price: number;
  roulette_value: number;
  rarity: string;
};
type ShopInventoryItem = {
  id: number;
  item_name: string;
  emoji: string;
  roulette_value: number;
  status: string;
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export function OffPage() {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<GameKey>("hub");
  const [duelInitialLobbyId, setDuelInitialLobbyId] = useState<number | null>(null);
  const [cipherInitialLobbyId, setCipherInitialLobbyId] = useState<number | null>(null);
  const [clashInitialLobbyId, setClashInitialLobbyId] = useState<number | null>(null);
  const [shopCatalog, setShopCatalog] = useState<ShopCatalogItem[]>([]);
  const [tlPackages, setTlPackages] = useState<TechStoreTlPackage[]>([]);
  const [shopInventory, setShopInventory] = useState<ShopInventoryItem[]>([]);
  const [shopMessage, setShopMessage] = useState("");
  const [buyingSlug, setBuyingSlug] = useState<string | null>(null);


  useEffect(() => {
    const syncFromRoute = () => {
      const params = new URLSearchParams(window.location.search || "");
      const game = params.get("game");
      const lobbyIdRaw = params.get("lobbyId");
      const lobbyId = Number(lobbyIdRaw || 0);
      if (game === "duel" || game === "cipher" || game === "clash") setActiveGame(game as any);
      const v = Number.isFinite(lobbyId) && lobbyId > 0 ? lobbyId : null;
      setDuelInitialLobbyId(game === "duel" ? v : null);
      setCipherInitialLobbyId(game === "cipher" ? v : null);
      setClashInitialLobbyId(game === "clash" ? v : null);
    };

    syncFromRoute();
    window.addEventListener("ekatech-route-change", syncFromRoute);
    return () => window.removeEventListener("ekatech-route-change", syncFromRoute);
  }, []);
  const copy = tr
    ? {
        loading: "OFF alanı kontrol ediliyor...",
        accessDeniedTitle: "OFF erişimi gerekli",
        accessDeniedDesc: "Bu sayfa OFF, admin ve owner hesapları için açık.",
        signIn: "Giriş yap",
        home: "Ana sayfa",
        eyebrow: "OFF özel oyun alanı",
        title: "EkaTech OFF Hub",
        subtitle:
          "OFF rolü arkadaşlarla takılmak, Tech Duel oynamak ve coin puanı biriktirmek için özel ara rol.",
        available: "Aktif oyun",
        comingSoon: "Yakında",
        open: "Aç",
        backHub: "OFF Hub'a dön",
        duelTitle: "Tech Duel",
        duelDesc:
          "Aynı anda başlayan roundlar, tur kazananı gösterimi, Best of 3/5/7 ve güvenli sabit ödül sistemi.",
        cipherTitle: "Cipher Break",
        cipherDesc:
          "2 kişilik premium kod kilitleme düellosu. Hedef kodu takip et, doğru kod hizaya geldiğinde ilk kilitleyen round'u alır.",
        clashTitle: "Core Clash",
        clashDesc:
          "2 kişilik stratejik kart düellosu. 3 kartla başla, harita boostlarını kullan, 20 saniyede en iyi counter hamleyi seç.",
        raidTitle: "Core Raid",
        raidDesc:
          "Community boss event. Glitch Titan sayfayı bozuyor; görev yap, hasar ver, core'u birlikte restore et.",
        marketTitle: "Eka InvestSim",
        marketDesc:
          "Gerçek para ve gerçek hisse kullanmadan portföy, risk, haber etkisi ve sanal al-sat mantığını öğreten borsa simülasyonu.",
        minerTitle: "TechCoin Miner",
        minerDesc:
          "3 miner serverdan birine bağlan. Aynı anda sadece 1 server kullan, dakikada 3 Tech Coin üret, 1 saatin sonunda server otomatik boşalsın.",
        droptechTitle: "DropTech",
        droptechDesc:
          "Kutu aç, ışıklı şeritte item yakala ve OFF'a özel emoji koleksiyonunu tamamla. Eşyalar kullanılmaz; sadece envanterde görünür.",
        minesTitle: "TechMines",
        minesDesc:
          "Gerçek para tamamen OFF. 25 karoda mayınlardan kaç, kombinasyon tabanlı %99 RTP çarpanıyla canlı Tech Coin cüzdan bakiyeni yönet.",
        towersTitle: "Eka Towers",
        towersDesc:
          "Canlı OFF Tech Coin cüzdanıyla 9 katlı kuleye tırman. Sabit bahis yok; istediğin TC miktarını gir, zorluk matrisi ve dinamik cashout çarpanlarıyla oyna.",
        aviatorTitle: "Tech Aviator",
        aviatorDesc:
          "Tech Coin ile uçuş rounduna katıl, çarpan yükselirken zamanında cashout yap ve provably-fair hash/salt bilgisini takip et.",
        rouletteTitle: "Tech Roulette",
        rouletteDesc:
          "OFF Hub cüzdanına bağlı Avrupa ruleti. Halıdan sayı/dış bahis seç, kendi TC miktarını yaz; SQL ekatechwallet kilidi, backend RNG ve log tablosu sonucu korur.",
        diceTitle: "Tech Dice",
        diceDesc:
          "0-100 slider ile Roll Over veya Roll Under seç; yeşil bölge şansı, çarpanı ve Tech Coin reward ihtimalini canlı gör.",
        blackjackTitle: "Tech Blackjack",
        memeClickerTitle: "Meme Clicker",
        memeClickerDesc:
          "Büyük butona bas, rastgele meme sesi çalsın ve Tech Coin kazan.",
        blackjackDesc:
          "Canlı OFF Hub Tech Coin cüzdanıyla 3:2 blackjack, double ve split kararlarını premium kart masasında oyna.",
        minesRemoved:
          "EkaMines yerine gerçek para OFF, ana Tech Coin cüzdanına bağlı TechMines aktif.",
        walletTitle: "Tech Coin cüzdanı",
        lifetime: "Toplam kazanılan",
        currency: "Para birimi",
        fixedRewardLabel: "Oyun ödülleri",
        rewardRule: "Ödül kuralı",
        shopTitle: "Tech Store",
        shopDesc:
          "Saat, çakmak ve özel aksesuarları Tech Coin ile satın al. Tech Store artık vitrin değil; OFF Hub içinden uygulama gibi açılır ve satılan eşyalar içeride görünür.",
        shopAppDesc:
          "Saat, çakmak ve özel aksesuarları ayrı Tech Store uygulamasında görüntüle; satın alıp racon envanterine ekle.",
        shopPanelHeading: "Satılan eşyalar",
        buy: "Satın al",
        inventory: "Racon envanteri",
        onlyRoulette: "Sadece rulette bahis değeri",
        tlPackages: "TL paketleri",
        tlPackageDesc:
          "Tech Store TL üzerinden satın alım alanı. Buton, gerçek API kullanmadan simüle EkaPay Secure ödeme geçidine yönlendirir.",
        packageIncludes: "Paket içeriği",
        levelTitle: "OFF Level",
        expToNext: "sonraki levele",
        verifiedName: "Level 5+ mavi tik",
      }
    : {
        loading: "Checking OFF access...",
        accessDeniedTitle: "OFF access required",
        accessDeniedDesc:
          "This page is available to OFF, admin and owner accounts.",
        signIn: "Sign in",
        home: "Home",
        eyebrow: "OFF private game area",
        title: "EkaTech OFF Hub",
        subtitle:
          "The OFF role is a middle role for hanging out, playing games and collecting score coins.",
        available: "Available game",
        comingSoon: "Coming soon",
        open: "Open",
        backHub: "Back to OFF Hub",
        duelTitle: "Tech Duel",
        duelDesc:
          "Synchronized rounds, per-round winner reveal, Best of 3/5/7, and safe fixed reward logic.",
        cipherTitle: "Cipher Break",
        cipherDesc:
          "A premium 1v1 code-lock duel. Track the target code and lock first when the matching code aligns.",
        clashTitle: "Core Clash",
        clashDesc:
          "A 2-player strategic card duel. Start with 3 cards, use map boosts, and pick the best counter move in 20 seconds.",
        raidTitle: "Core Raid",
        raidDesc:
          "A community boss event. Glitch Titan corrupts the page; complete tasks, deal damage, and restore the core together.",
        marketTitle: "Eka InvestSim",
        marketDesc:
          "A stock market simulator that teaches portfolio, risk, news impact and virtual buy/sell logic without real money or real stocks.",
        minerTitle: "TechCoin Miner",
        minerDesc:
          "Connect to one of 3 miner servers. Use only 1 server at a time, earn 3 Tech Coin per minute, and automatically release the server after 1 hour.",
        droptechTitle: "DropTech",
        droptechDesc:
          "Open boxes, catch an item on the glowing strip, and complete your OFF-only emoji collection. Items are not usable; they only appear in inventory.",
        minesTitle: "TechMines",
        minesDesc:
          "Real money is fully OFF. Dodge mines on 25 tiles and manage your live Tech Coin wallet balance with combination-based 99% RTP multipliers.",
        towersTitle: "Eka Towers",
        towersDesc:
          "Climb a 9-level tower with the live OFF Tech Coin wallet. Fixed bets are removed; enter any TC amount and play difficulty matrices with dynamic cashout multipliers.",
        aviatorTitle: "Tech Aviator",
        aviatorDesc:
          "Join flight rounds with Tech Coin, cash out while the multiplier climbs, and follow the provably-fair hash/salt data.",
        rouletteTitle: "Tech Roulette",
        rouletteDesc:
          "European roulette connected to the OFF Hub wallet. Tap the table for number/outside bets, enter your own TC amount, and let SQL locking, backend RNG and logs protect every round.",
        diceTitle: "Tech Dice",
        diceDesc:
          "Choose Roll Over or Roll Under on a 0-100 slider; see the green zone chance, multiplier and Tech Coin reward live.",
        blackjackTitle: "Tech Blackjack",
        memeClickerTitle: "Meme Clicker",
        memeClickerDesc:
          "Büyük butona bas, rastgele meme sesi çalsın ve Tech Coin kazan.",
        blackjackDesc:
          "Play 3:2 blackjack, double down and split decisions on a premium card table connected to the live OFF Hub Tech Coin wallet.",
        minesRemoved:
          "TechMines is active with real money OFF and the main Tech Coin wallet connected.",
        walletTitle: "Tech Coin wallet",
        lifetime: "Lifetime earned",
        currency: "Currency",
        fixedRewardLabel: "Game rewards",
        rewardRule: "Reward rule",
        shopTitle: "Tech Store",
        shopDesc:
          "Buy watches, lighters and special accessories with Tech Coin. Tech Store is no longer an entrance showcase; it opens like an app inside OFF Hub and shows the items for sale inside.",
        shopAppDesc:
          "View watches, lighters and special accessories in the separate Tech Store app; buy them and add them to your swagger inventory.",
        shopPanelHeading: "Items for sale",
        buy: "Buy",
        inventory: "Swagger inventory",
        onlyRoulette: "Roulette stake only",
        tlPackages: "TRY packages",
        tlPackageDesc:
          "Tech Store purchase area in Turkish Lira. Until payment integration is connected, the button safely credits the package to the account.",
        packageIncludes: "Package includes",
        levelTitle: "OFF Level",
        expToNext: "to next level",
        verifiedName: "Level 5+ blue check",
      };

  useEffect(() => {
    let active = true;
    fetch("/api/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.json().catch(() => null))
      .then((data) => {
        if (active) setUser(data?.loggedIn ? data.user : null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let active = true;
    const loadWallet = () => {
      fetch("/api/coins", { credentials: "same-origin", cache: "no-store" })
        .then(async (response) => response.json().catch(() => null))
        .then((data) => {
          if (!active || !data) return;
          setWallet({
            currency: data.currency || "Tech Coin",
            symbol: data.symbol || "TC",
            balance: Number(data.balance || 0),
            lifetime_earned: Number(data.lifetime_earned || 0),
            updated_at: data.updated_at || null,
            level: data.level,
          });
        })
        .catch(() => {
          if (active)
            setWallet({
              currency: "Tech Coin",
              symbol: "TC",
              balance: 0,
              lifetime_earned: 0,
            });
        });
    };

    loadWallet();
    const timer = window.setInterval(loadWallet, 60_000);
    window.addEventListener("ekatech-techcoin-refresh", loadWallet);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("ekatech-techcoin-refresh", loadWallet);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const loadShop = () => {
      fetch("/api/off-shop", { credentials: "same-origin", cache: "no-store" })
        .then(async (response) => response.json().catch(() => null))
        .then((data) => {
          if (!active || !data) return;
          setShopCatalog(Array.isArray(data.catalog) ? data.catalog : []);
          setTlPackages(Array.isArray(data.tlPackages) ? data.tlPackages : []);
          setShopInventory(Array.isArray(data.inventory) ? data.inventory : []);
        })
        .catch(() => {
          if (active) setShopMessage("OFF mağaza yüklenemedi.");
        });
    };
    loadShop();
    window.addEventListener("ekatech-techcoin-refresh", loadShop);
    return () => {
      active = false;
      window.removeEventListener("ekatech-techcoin-refresh", loadShop);
    };
  }, [user?.id]);

  const buyShopItem = async (
    slug: string,
    type: "item" | "tl-package" = "item",
  ) => {
    if (type === "tl-package") {
      setBuyingSlug(slug);
      setShopMessage("Güvenli ödeme sayfasına yönlendiriliyorsunuz...");
      const pack = tlPackages.find((item) => item.slug === slug);
      if (pack) window.sessionStorage.setItem("ekatech:checkout-package", JSON.stringify(pack));
      window.dispatchEvent(new CustomEvent("ekatech-start-techcoin-checkout", { detail: pack }));
      window.setTimeout(() => setBuyingSlug(null), 1800);
      return;
    }

    setBuyingSlug(slug);
    setShopMessage("");
    try {
      const response = await fetch("/api/off-shop", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, type }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Ürün alınamadı.");
      setShopInventory(Array.isArray(data.inventory) ? data.inventory : []);
      if (data.wallet)
        setWallet((current) => ({
          ...data.wallet,
          level: data.level || current?.level,
        }));
      setShopMessage(data?.message || "Ürün envantere eklendi.");
      window.dispatchEvent(new Event("ekatech-techcoin-refresh"));
      playOffSound("coin");
    } catch (error) {
      setShopMessage(
        error instanceof Error ? error.message : "Ürün alınamadı.",
      );
      playOffSound("error");
    } finally {
      setBuyingSlug(null);
    }
  };

  const canAccess =
    user?.role === "off" || user?.role === "admin" || user?.role === "owner";

  const handleGameBoundaryBack = () => setActiveGame("hub");

  if (loading) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-8 text-white/55 backdrop-blur-xl">
          {copy.loading}
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="relative flex min-h-screen items-center overflow-hidden bg-black px-4 py-24 sm:px-6">
        <div className="absolute left-1/2 top-28 h-80 w-80 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center backdrop-blur-xl sm:p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-purple-200/20 bg-purple-200/10 text-purple-100">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-white">
            {copy.accessDeniedTitle}
          </h1>
          <p className="mt-4 leading-7 text-white/55">
            {copy.accessDeniedDesc}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigateTo("/signin?authorized=1")}
              className="rounded-full bg-white px-5 py-3 font-medium text-black transition-all hover:bg-gray-200"
            >
              {copy.signIn}
            </button>
            <button
              type="button"
              onClick={() => navigateTo("/")}
              className="rounded-full border border-white/10 bg-white/[0.06] px-5 py-3 font-medium text-white/80 transition-all hover:bg-white/[0.1]"
            >
              {copy.home}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (activeGame !== "hub") {
    return (
      <>
        <div className="fixed right-5 top-24 z-[80] flex flex-col items-end gap-3 px-2 sm:right-6">
          <button
            type="button"
            onClick={() => {
              playOffSound("click");
              setActiveGame("hub");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full border border-cyan-300/20 bg-black/85 px-4 py-2.5 text-xs font-medium text-cyan-100 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all hover:bg-cyan-300/10 sm:px-5 sm:py-3 sm:text-sm"
          >
            ← {copy.backHub}
          </button>
          <TechCoinWalletBadge />
        </div>
        {activeGame === "duel" ? (
          <GameErrorBoundary gameName="Tech Duel" onBack={handleGameBoundaryBack}>
            <TechDuelSync initialLobbyId={duelInitialLobbyId} />
            <TechDuelBotAssist />
          </GameErrorBoundary>
        ) : activeGame === "cipher" ? (
          <GameErrorBoundary gameName="Cipher Break" onBack={handleGameBoundaryBack}>
            <CipherBreak initialLobbyId={cipherInitialLobbyId} />
          </GameErrorBoundary>
        ) : activeGame === "clash" ? (
          <GameErrorBoundary gameName="Core Clash" onBack={handleGameBoundaryBack}>
            <CoreClash initialLobbyId={clashInitialLobbyId} />
          </GameErrorBoundary>
        ) : activeGame === "raid" ? (
          <GameErrorBoundary gameName="Core Raid" onBack={handleGameBoundaryBack}>
            <CoreRaid />
          </GameErrorBoundary>
        ) : activeGame === "miner" ? (
          <GameErrorBoundary gameName="Tech Coin Miner" onBack={handleGameBoundaryBack}>
            <TechCoinMiner />
          </GameErrorBoundary>
        ) : activeGame === "droptech" ? (
          <GameErrorBoundary gameName="DropTech" onBack={handleGameBoundaryBack}>
            <DropTech />
          </GameErrorBoundary>
        ) : activeGame === "mines" ? (
          <GameErrorBoundary gameName="Tech Coin Mines" onBack={handleGameBoundaryBack}>
            <TechCoinMines />
          </GameErrorBoundary>
        ) : activeGame === "towers" ? (
          <GameErrorBoundary gameName="Eka Towers" onBack={handleGameBoundaryBack}>
            <EkaTowers />
          </GameErrorBoundary>
        ) : activeGame === "aviator" ? (
          <GameErrorBoundary gameName="Tech Aviator" onBack={handleGameBoundaryBack}>
            <TechAviator />
          </GameErrorBoundary>
        ) : activeGame === "dice" ? (
          <GameErrorBoundary gameName="Tech Dice" onBack={handleGameBoundaryBack}>
            <TechDice />
          </GameErrorBoundary>
        ) : activeGame === "blackjack" ? (
          <GameErrorBoundary gameName="Tech Blackjack" onBack={handleGameBoundaryBack}>
            <TechBlackjack />
          </GameErrorBoundary>
        ) : activeGame === "roulette" ? (
          <GameErrorBoundary
            gameName="Tech Roulette"
            onBack={handleGameBoundaryBack}
          >
            <Suspense
              fallback={
                <main className="relative min-h-screen bg-black px-4 pb-24 pt-32 text-white sm:px-6">
                  <div className="mx-auto max-w-2xl rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-6 text-center shadow-2xl shadow-amber-500/10 backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-100/70">
                      Tech Roulette yükleniyor
                    </p>
                    <p className="mt-3 text-sm leading-6 text-white/60">
                      Oyun modülü hazırlanıyor; hub ekranı bu yüklemeden
                      etkilenmez.
                    </p>
                  </div>
                </main>
              }
            >
              <TechRoulette />
            </Suspense>
          </GameErrorBoundary>
        ) : activeGame === "memeClicker" ? (
          <GameErrorBoundary gameName="Meme Clicker" onBack={handleGameBoundaryBack}>
            <MemeClicker onBack={() => setActiveGame("hub")} />
          </GameErrorBoundary>
        ) : activeGame === "store" ? (
          <OffShopApp
            catalog={shopCatalog}
            tlPackages={tlPackages}
            inventory={shopInventory}
            message={shopMessage}
            buyingSlug={buyingSlug}
            copy={copy}
            locale={tr ? "tr-TR" : "en-US"}
            onBuy={buyShopItem}
          />
        ) : (
          <GameErrorBoundary gameName="Eka InvestSim" onBack={handleGameBoundaryBack}>
            <MarketAcademy />
          </GameErrorBoundary>
        )}
      </>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-40 pt-32 sm:px-6">
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-purple-500/10 backdrop-blur-xl sm:p-8"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-purple-100/80">
                <Gamepad2 className="h-4 w-4" /> {copy.eyebrow}
              </div>
              <h1 className="mt-5 text-5xl font-medium tracking-tight text-white sm:text-7xl">
                {copy.title}
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
                {copy.subtitle}
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm leading-6 text-emerald-100">
              {copy.minesRemoved}
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <CoinWalletCard
            wallet={wallet}
            copy={copy}
            locale={tr ? "tr-TR" : "en-US"}
          />
          <div className="space-y-5">
            <LevelCard
              level={wallet?.level}
              copy={copy}
              locale={tr ? "tr-TR" : "en-US"}
            />
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
              <p className="text-sm text-white/40">{copy.rewardRule}</p>
              <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-medium text-white">
                <span>{copy.fixedRewardLabel}:</span>
                <CoinAmount
                  amount={50}
                  locale={tr ? "tr-TR" : "en-US"}
                  size="md"
                  tone="cyan"
                />
                <span className="text-white/35">/</span>
                <CoinAmount
                  amount={40}
                  locale={tr ? "tr-TR" : "en-US"}
                  size="md"
                  tone="amber"
                />
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/50">
                {copy.minesRemoved}
              </p>
            </div>
          </div>
        </section>
        <OffLeaderboardCard tr={tr} role={String(user?.role || '')} />

        <OffFriendsPanel />

        <section className="grid gap-5 pb-40 md:grid-cols-2 xl:grid-cols-3">
          <GameCard
            icon={<Store className="h-6 w-6" />}
            status={copy.available}
            title={copy.shopTitle}
            description={copy.shopAppDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("click");
              setActiveGame("store");
            }}
          />
          <GameCard
            icon={<Sparkles className="h-6 w-6" />}
            status={copy.available}
            title={copy.memeClickerTitle}
            description={copy.memeClickerDesc}
            accent="purple"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("click");
              setActiveGame("memeClicker");
            }}
          />
          <GameCard
            icon={<Swords className="h-6 w-6" />}
            status={copy.available}
            title={copy.duelTitle}
            description={copy.duelDesc}
            accent="cyan"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("join");
              setActiveGame("duel");
            }}
          />
          <GameCard
            icon={<Zap className="h-6 w-6" />}
            status={copy.available}
            title={copy.cipherTitle}
            description={copy.cipherDesc}
            accent="purple"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("code");
              setActiveGame("cipher");
            }}
          />
          <GameCard
            icon={<Gamepad2 className="h-6 w-6" />}
            status={copy.available}
            title={copy.clashTitle}
            description={copy.clashDesc}
            accent="cyan"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("card");
              navigateTo("/core-clash");
            }}
          />
          <GameCard
            icon={<Gift className="h-6 w-6" />}
            status={copy.available}
            title={copy.droptechTitle}
            description={copy.droptechDesc}
            accent="purple"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("reel");
              setActiveGame("droptech");
            }}
          />
          <GameCard
            icon={<Shield className="h-6 w-6" />}
            status={copy.available}
            title={copy.minesTitle}
            description={copy.minesDesc}
            accent="cyan"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("bet");
              setActiveGame("mines");
            }}
          />
          <GameCard
            icon={<Building2 className="h-6 w-6" />}
            status={copy.available}
            title={copy.towersTitle}
            description={copy.towersDesc}
            accent="cyan"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("bet");
              setActiveGame("towers");
            }}
          />
          <GameCard
            icon={<Plane className="h-6 w-6" />}
            status={copy.available}
            title={copy.aviatorTitle}
            description={copy.aviatorDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("bet");
              setActiveGame("aviator");
            }}
          />
          <GameCard
            icon={<CircleDot className="h-6 w-6" />}
            status={copy.available}
            title={copy.rouletteTitle}
            description={copy.rouletteDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("bet");
              setActiveGame("roulette");
            }}
          />
          <GameCard
            icon={<Dice5 className="h-6 w-6" />}
            status={copy.available}
            title={copy.diceTitle}
            description={copy.diceDesc}
            accent="cyan"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("bet");
              setActiveGame("dice");
            }}
          />
          <GameCard
            icon={<Club className="h-6 w-6" />}
            status={copy.available}
            title={copy.blackjackTitle}
            description={copy.blackjackDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("card");
              setActiveGame("blackjack");
            }}
          />
          <GameCard
            icon={<Trophy className="h-6 w-6" />}
            status={copy.available}
            title={copy.raidTitle}
            description={copy.raidDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("raid");
              setActiveGame("raid");
            }}
          />
          <GameCard
            icon={<BarChart3 className="h-6 w-6" />}
            status={copy.available}
            title={copy.marketTitle}
            description={copy.marketDesc}
            accent="purple"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("market");
              setActiveGame("market");
            }}
          />
          <GameCard
            icon={<Pickaxe className="h-6 w-6" />}
            status={copy.available}
            title={copy.minerTitle}
            description={copy.minerDesc}
            accent="amber"
            buttonLabel={copy.open}
            onClick={() => {
              playOffSound("server");
              setActiveGame("miner");
            }}
          />
        </section>
      </div>
    </main>
  );
}


function OffLeaderboardCard({ tr, role }: { tr: boolean; role: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [seasonId, setSeasonId] = useState(0);
  const [gameKey, setGameKey] = useState('');
  const [debugData, setDebugData] = useState<any>(null);
  const [busyAction, setBusyAction] = useState<'debug' | 'repair' | ''>('');
  const isAdmin = role === 'admin' || role === 'owner';
  const likelyProblem =
    debugData?.health?.likelyProblem ||
    debugData?.failedStep ||
    debugData?.error ||
    'debug_not_run';
  const likelyProblemLabel =
    likelyProblem === 'debug_not_run'
      ? 'Debug çalıştırılmadı'
      : likelyProblem === 'needs_inspection'
      ? 'Debug response eksik'
      : String(likelyProblem);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const u = new URL('/api/off/leaderboard', window.location.origin);
      u.searchParams.set('seasonId', String(seasonId));
      u.searchParams.set('limit', '10');
      if (gameKey) u.searchParams.set('gameKey', gameKey);
      const r = await fetch(u.toString(), { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      setRows(Array.isArray(d?.leaderboard) ? d.leaderboard : []);
      setLoading(false);
    })();
  }, [seasonId, gameKey]);
  const runDebug = async () => {
    setBusyAction('debug');
    try {
      const r = await fetch('/api/off/leaderboard/debug', { credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      setDebugData(d || {});
    } finally { setBusyAction(''); }
  };
  const runRepair = async () => {
    setBusyAction('repair');
    try {
      const r = await fetch('/api/off/leaderboard/repair', { method: 'POST', credentials: 'same-origin' });
      const d = await r.json().catch(() => ({}));
      setDebugData(d || {});
      window.dispatchEvent(new CustomEvent('ekatech-toast', { detail: { type: r.ok ? 'success' : 'error', message: r.ok ? 'Leaderboard repair tamamlandı.' : (d?.error || 'Leaderboard repair başarısız.') } }));
      const debugRes = await fetch('/api/off/leaderboard/debug', { credentials: 'same-origin' });
      const debugJson = await debugRes.json().catch(() => ({}));
      setDebugData({ ...(d || {}), debug: debugJson || {} });
      const u = new URL('/api/off/leaderboard', window.location.origin);
      u.searchParams.set('seasonId', String(seasonId)); u.searchParams.set('limit', '10'); if (gameKey) u.searchParams.set('gameKey', gameKey);
      const rr = await fetch(u.toString(), { credentials: 'same-origin' }); const dd = await rr.json().catch(() => ({})); setRows(Array.isArray(dd?.leaderboard) ? dd.leaderboard : []);
    } finally { setBusyAction(''); }
  };
  return <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-medium text-white">OFF Leaderboard</h2>
      <div className="flex gap-2 text-xs">
        <button onClick={() => setSeasonId(0)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-white">All Time</button>
        <select value={gameKey} onChange={(e) => setGameKey(e.target.value)} className="rounded-full border border-white/10 bg-black px-3 py-1.5 text-white">
          <option value="">{tr ? 'Tümü' : 'All'}</option><option value="tech_duel">Tech Duel</option><option value="cipher_break">Cipher Break</option><option value="core_clash">Core Clash</option>
        </select>
        {isAdmin ? <button onClick={runDebug} disabled={busyAction!==''} className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1.5 text-cyan-100 disabled:opacity-60">Debug Leaderboard</button> : null}
        {isAdmin ? <button onClick={runRepair} disabled={busyAction!==''} className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-100 disabled:opacity-60">Repair Leaderboard</button> : null}
      </div></div>
    {loading ? <p className="mt-4 text-white/50">...</p> : rows.length === 0 ? <div className="mt-4 space-y-2"><p className="text-white/50">{isAdmin ? `Leaderboard boş. Muhtemel sebep: ${likelyProblemLabel}` : 'Henüz leaderboard verisi yok.'}</p>{isAdmin ? <p className="text-xs text-amber-100/80">Debug / Repair çalıştır.</p> : null}</div> : <div className="mt-4 space-y-2">{rows.map((r, i) => <div key={r.userId} className={`flex items-center justify-between rounded-2xl border p-3 ${i===0?'border-amber-300/30 bg-amber-300/10':i<3?'border-purple-300/20 bg-purple-300/10':'border-white/10 bg-black/30'}`}><div className="flex items-center gap-3"><span className="w-6 text-white/70">#{r.rank}</span><img src={r.avatarUrl || '/og-image.svg'} className="h-8 w-8 rounded-full object-cover" /><div><p className="text-white">{r.displayName}</p><p className="text-xs text-white/45">{r.wins}/{r.totalMatches} · %{Number(r.winRate||0).toFixed(1)}</p></div></div><p className="font-semibold text-cyan-100">{r.totalPoints}</p></div>)}</div>}
    {isAdmin && Array.isArray(debugData?.steps) ? <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/80">
      <p className="font-semibold text-white/90">Repair Steps</p>
      {debugData.steps.map((step: any, idx: number) => <p key={`${String(step?.step || 'step')}-${idx}`}>{String(step?.step || 'step')}: {step?.ok === false ? 'fail' : 'ok'}</p>)}
      {debugData.steps.find((s: any) => s?.step === 'final_counts') ? <p className="pt-1 text-emerald-200">Final counts hazır.</p> : null}
    </div> : null}
    {isAdmin && debugData ? <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/75">{JSON.stringify(debugData, null, 2)}</pre> : null}
  </section>
}

function OffShopApp({
  catalog,
  tlPackages,
  inventory,
  message,
  buyingSlug,
  copy,
  locale,
  onBuy,
}: {
  catalog: ShopCatalogItem[];
  tlPackages: TechStoreTlPackage[];
  inventory: ShopInventoryItem[];
  message: string;
  buyingSlug: string | null;
  copy: any;
  locale: string;
  onBuy: (slug: string, type?: "item" | "tl-package") => void;
}) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black px-4 pb-24 pt-32 text-white sm:px-6">
      <div className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="absolute right-0 top-64 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <motion.section
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.07] p-6 shadow-2xl shadow-amber-500/10 backdrop-blur-xl sm:p-8"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-sm text-amber-100">
            <Store className="h-4 w-4" /> {copy.shopTitle}
          </div>
          <h1 className="mt-5 text-5xl font-medium tracking-tight text-white sm:text-7xl">
            {copy.shopTitle}
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">
            {copy.shopAppDesc}
          </p>
        </motion.section>

        <OffShopPanel
          catalog={catalog}
          tlPackages={tlPackages}
          inventory={inventory}
          message={message}
          buyingSlug={buyingSlug}
          copy={copy}
          locale={locale}
          onBuy={onBuy}
        />
      </div>
    </main>
  );
}

function OffShopPanel({
  catalog,
  tlPackages,
  inventory,
  message,
  buyingSlug,
  copy,
  locale,
  onBuy,
}: {
  catalog: ShopCatalogItem[];
  tlPackages: TechStoreTlPackage[];
  inventory: ShopInventoryItem[];
  message: string;
  buyingSlug: string | null;
  copy: any;
  locale: string;
  onBuy: (slug: string, type?: "item" | "tl-package") => void;
}) {
  const availableInventory = inventory.filter(
    (item) => item.status === "available",
  );
  return (
    <section className="rounded-[2rem] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(146,64,14,0.24),rgba(0,0,0,0.42))] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-200/10 px-4 py-2 text-sm text-amber-100">
            <Store className="h-4 w-4" /> {copy.shopTitle}
          </div>
          <h2 className="mt-4 text-3xl font-medium text-white">
            {copy.shopPanelHeading}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            {copy.shopDesc}
          </p>
          {message && (
            <p className="mt-4 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-amber-100">
              {message}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/25 p-4 text-sm text-white/60">
          <div className="flex items-center gap-2 font-medium text-white">
            <ShoppingBag className="h-4 w-4 text-amber-100" /> {copy.inventory}
          </div>
          <p className="mt-2">
            {availableInventory.length
              ? availableInventory
                  .map((item) => `${item.emoji} ${item.item_name}`)
                  .join(" · ")
              : "Envanter boş"}
          </p>
        </div>
      </div>
      <div className="mt-6 rounded-[1.75rem] border border-cyan-200/20 bg-cyan-300/[0.07] p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-white">
              {copy.tlPackages}
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              {copy.tlPackageDesc}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {tlPackages.map((pack) => (
            <div
              key={pack.slug}
              className="rounded-[1.4rem] border border-white/10 bg-black/35 p-4 shadow-xl shadow-cyan-950/20"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/65">
                {copy.packageIncludes}
              </p>
              <h4 className="mt-2 text-xl font-semibold text-white">
                {pack.name}
              </h4>
              <p className="mt-3 text-3xl font-black text-cyan-100">
                {pack.priceTl}
              </p>
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div className="flex justify-between gap-3">
                  <span>Tech Coin</span>
                  <strong className="text-white">
                    {new Intl.NumberFormat(locale).format(pack.techCoin)} TC
                  </strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>EXP</span>
                  <strong className="text-white">
                    {new Intl.NumberFormat(locale).format(pack.exp)} EXP
                  </strong>
                </div>
              </div>
              <button
                type="button"
                disabled={buyingSlug === pack.slug}
                onClick={() => onBuy(pack.slug, "tl-package")}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-cyan-100 px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />{" "}
                {buyingSlug === pack.slug ? "..." : copy.buy}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {catalog.map((item) => (
          <div
            key={item.slug}
            className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-4xl">{item.emoji}</span>
              <span className="rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1 text-xs text-amber-100">
                {item.rarity}
              </span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-white">
              {item.name}
            </h3>
            <p className="mt-2 min-h-20 text-sm leading-6 text-white/48">
              {item.description}
            </p>
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm">
              <div className="flex justify-between gap-3 text-white/60">
                <span>Fiyat</span>
                <strong className="text-white">
                  {new Intl.NumberFormat(locale).format(item.price)} TC
                </strong>
              </div>
              <div className="flex justify-between gap-3 text-amber-100/80">
                <span>{copy.onlyRoulette}</span>
                <strong>
                  {new Intl.NumberFormat(locale).format(item.roulette_value)} TC
                </strong>
              </div>
            </div>
            <button
              type="button"
              disabled={buyingSlug === item.slug}
              onClick={() => onBuy(item.slug)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />{" "}
              {buyingSlug === item.slug ? "..." : copy.buy}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function LevelCard({
  level,
  copy,
  locale,
}: {
  level?: LevelProgress;
  copy: any;
  locale: string;
}) {
  const progress = level || {
    level: 1,
    exp: 0,
    currentLevelExp: 0,
    nextLevelExp: 135,
    expIntoLevel: 0,
    expNeededForNext: 135,
    verified: false,
  };
  const span = Math.max(
    1,
    Number(progress.nextLevelExp || 0) - Number(progress.currentLevelExp || 0),
  );
  const percent = Math.max(
    0,
    Math.min(100, (Number(progress.expIntoLevel || 0) / span) * 100),
  );
  return (
    <div className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/[0.07] p-5 backdrop-blur-xl sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-cyan-100/65">{copy.levelTitle}</p>
        {progress.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-300/30 bg-blue-400/15 px-3 py-1 text-xs font-semibold text-blue-100">
            ✓ {copy.verifiedName}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex items-end gap-3">
        <Award className="mb-1 h-8 w-8 text-cyan-100" />
        <strong className="text-4xl text-white">
          Lv. {new Intl.NumberFormat(locale).format(progress.level)}
        </strong>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/35 ring-1 ring-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-400"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-white/50">
        {new Intl.NumberFormat(locale).format(progress.expNeededForNext)} EXP{" "}
        {copy.expToNext}
      </p>
    </div>
  );
}

function CoinWalletCard({
  wallet,
  copy,
  locale,
}: {
  wallet: Wallet | null;
  copy: any;
  locale: string;
}) {
  const balance = Number(wallet?.balance || 0);
  const lifetime = Number(wallet?.lifetime_earned || 0);
  const currency = wallet?.currency || "Tech Coin";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.08] p-5 shadow-2xl shadow-amber-500/10 backdrop-blur-xl sm:p-6">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="relative">
        <p className="text-sm uppercase tracking-[0.2em] text-amber-100/60">
          {copy.walletTitle}
        </p>
        <div className="mt-3">
          <CoinAmount amount={balance} locale={locale} size="xl" tone="amber" />
        </div>
        <p className="mt-2 text-sm text-amber-100/80">{currency}</p>
      </div>
      <div className="relative mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/35">
            {copy.currency}
          </p>
          <p className="mt-2 text-lg font-medium text-white">{currency}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-white/35">
            {copy.lifetime}
          </p>
          <div className="mt-2">
            <CoinAmount
              amount={lifetime}
              locale={locale}
              size="sm"
              tone="amber"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CoinAmount({
  amount,
  locale,
  size,
  tone,
}: {
  amount: number;
  locale: string;
  size: "sm" | "md" | "xl";
  tone: "cyan" | "amber";
}) {
  const formatted = new Intl.NumberFormat(locale).format(amount || 0);
  const textSize =
    size === "xl" ? "text-5xl" : size === "md" ? "text-2xl" : "text-lg";
  const iconSize = size === "xl" ? "sm" : "xs";

  return (
    <span
      className={`inline-flex items-center gap-2 font-semibold tracking-tight text-white ${textSize}`}
    >
      <span>{formatted}</span>
      <CoinIcon size={iconSize} tone={tone} />
    </span>
  );
}

function CoinIcon({
  size,
  tone,
}: {
  size: "xs" | "sm" | "md" | "lg";
  tone: "cyan" | "amber";
}) {
  const wrapperSize =
    size === "lg"
      ? "h-14 w-14"
      : size === "md"
        ? "h-11 w-11"
        : size === "sm"
          ? "h-8 w-8"
          : "h-5 w-5";
  const glow = tone === "amber" ? "shadow-amber-500/20" : "shadow-cyan-500/20";
  const ring = tone === "amber" ? "border-amber-300/30" : "border-cyan-300/30";
  const bg = tone === "amber" ? "bg-amber-100/5" : "bg-cyan-100/5";

  return (
    <span
      className={`inline-flex ${wrapperSize} shrink-0 items-center justify-center overflow-hidden rounded-full border ${ring} ${bg} p-[2px] shadow-xl ${glow}`}
    >
      <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/60">
        <img
          src={coinIcon}
          alt="Tech Coin"
          className="block h-full w-full rounded-full object-cover"
          style={{ clipPath: "circle(50% at 50% 50%)" }}
        />
      </span>
    </span>
  );
}

function GameCard({
  icon,
  status,
  title,
  description,
  accent,
  buttonLabel,
  locked = false,
  onClick,
}: {
  icon: ReactNode;
  status: string;
  title: string;
  description: string;
  accent: "cyan" | "purple" | "amber";
  buttonLabel?: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  const accentClasses = {
    cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
    purple: "border-purple-300/20 bg-purple-300/10 text-purple-100",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClasses[accent]}`}
        >
          {icon}
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${locked ? "border-white/10 bg-white/[0.04] text-white/40" : accentClasses[accent]}`}
        >
          {locked ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> {status}
            </span>
          ) : (
            status
          )}
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-medium text-white">{title}</h2>
      <p className="mt-3 min-h-24 text-sm leading-6 text-white/50">
        {description}
      </p>
      {locked ? (
        <button
          type="button"
          disabled
          className="mt-5 w-full rounded-full border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/35"
        >
          {status}
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-all hover:bg-gray-200"
        >
          <Sparkles className="h-4 w-4" /> {buttonLabel}
        </button>
      )}
    </motion.div>
  );
}
