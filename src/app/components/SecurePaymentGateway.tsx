import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type GatewayStage = "form" | "verifying" | "error";
type FailureScenario = "timeout" | "declined";

type CheckoutPackage = { slug: string; name: string; priceTl: string; techCoin: number; exp: number };

type PaymentForm = {
  holder: string;
  card: string;
  expiry: string;
  cvc: string;
};

const emptyForm: PaymentForm = {
  holder: "",
  card: "",
  expiry: "",
  cvc: "",
};

function navigateTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("ekatech-route-change"));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function announceCancelledPayment() {
  window.dispatchEvent(
    new CustomEvent("ekatech-payment-cancelled", {
      detail: {
        message: "Ödeme işlemi gerçekleştirilemediği için iptal edildi",
      },
    }),
  );
}

function maskCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function maskExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function SecurePaymentGateway() {
  const [stage, setStage] = useState<GatewayStage>("form");
  const [scenario, setScenario] = useState<FailureScenario>("timeout");
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [checkoutPackage] = useState<CheckoutPackage | null>(() => {
    try {
      const saved = window.sessionStorage.getItem("ekatech:checkout-package");
      return saved ? JSON.parse(saved) as CheckoutPackage : null;
    } catch {
      return null;
    }
  });

  const referenceCode = useMemo(
    () =>
      `EP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 899999)}`,
    [],
  );

  useEffect(() => {
    if (stage !== "error") return undefined;

    const timer = window.setTimeout(() => {
      navigateTo("/");
      announceCancelledPayment();
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [stage]);

  const submitPayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setScenario(Math.random() > 0.5 ? "timeout" : "declined");
    setStage("verifying");

    window.setTimeout(() => {
      setStage("error");
    }, 2300);
  };

  const cancelPayment = () => {
    navigateTo("/");
  };

  const updateForm = (field: keyof PaymentForm, value: string) => {
    setForm((current) => ({
      ...current,
      [field]:
        field === "card"
          ? maskCardNumber(value)
          : field === "expiry"
            ? maskExpiry(value)
            : value,
    }));
  };

  return (
    <main className="min-h-screen bg-[#eef2f7] text-slate-950">
      <div className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0a3d62] text-white shadow-lg shadow-blue-950/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-black tracking-tight text-[#0a3d62]">
                EkaPay Secure
              </p>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                3D Ödeme Geçidi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
            <Lock className="h-4 w-4" /> Güvenli bağlantı
          </div>
        </div>
      </div>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.35fr] lg:py-12">
        <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
            İşyeri ödeme bildirimi
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Sipariş Özeti
          </h1>
          <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-500">Ürün</span>
              <strong className="text-right text-slate-950">
                {checkoutPackage?.name || "TechCoin Paketi"}
              </strong>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-500">İşyeri</span>
              <strong className="text-right text-slate-950">
                EkaTech Dijital Hizmetler
              </strong>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span className="text-slate-500">İşlem No</span>
              <strong className="text-right font-mono text-slate-950">
                {referenceCode}
              </strong>
            </div>
            {checkoutPackage ? (
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-500">Paket İçeriği</span>
                <strong className="text-right text-slate-950">
                  {checkoutPackage.techCoin.toLocaleString("tr-TR")} TC · {checkoutPackage.exp.toLocaleString("tr-TR")} EXP
                </strong>
              </div>
            ) : null}
            <div className="border-t border-slate-200 pt-4">
              <div className="flex items-end justify-between gap-4">
                <span className="text-sm text-slate-500">Tutar</span>
                <strong className="text-3xl font-black text-[#0a3d62]">
                  {checkoutPackage?.priceTl || "149,90 TL"}
                </strong>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4" /> Banka güvenlik doğrulaması
            </div>
            Bu ekran ödeme altyapısı simülasyonudur; kart bilgileriniz herhangi
            bir sunucuya iletilmez.
          </div>
          <button
            type="button"
            onClick={cancelPayment}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> İptal Et ve EkaTech'e Geri Dön
          </button>
        </aside>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/50">
          {stage === "verifying" ? (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/95 px-6 text-center backdrop-blur-sm">
              <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-200 border-t-[#0a3d62]" />
              <h2 className="mt-6 text-2xl font-black text-slate-950">
                3D Secure doğrulaması bekleniyor
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Banka güvenlik ekranı hazırlanıyor. Lütfen sayfayı yenilemeyin
                ve tarayıcınızı kapatmayın.
              </p>
              <div className="mt-5 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                <Lock className="h-4 w-4" /> TLS 1.3 oturumu aktif
              </div>
            </div>
          ) : null}

          {stage === "error" ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600 shadow-2xl shadow-red-600/30">
                <XCircle className="h-12 w-12" />
              </div>
              <h2 className="mt-7 text-3xl font-black tracking-tight text-red-100">
                {scenario === "timeout"
                  ? "Ödeme Ağ Hatası"
                  : "İşlem Reddedildi"}
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
                {scenario === "timeout"
                  ? "HATA: Ödeme kuruluşu sunucularına bağlanılamadı (Hata Kodu: ERR_GATEWAY_TIMEOUT). Lütfen daha sonra tekrar deneyiniz."
                  : "İşlem Reddedildi: Bankanız bu işlem için onay vermedi (Bakiye Yetersiz veya Geçersiz Kart). Lütfen kart bilgilerinizi kontrol edin."}
              </p>
              <p className="mt-5 rounded-full border border-white/10 bg-white/10 px-5 py-2 text-sm text-slate-300">
                5 saniye içinde EkaTech ana sayfasına güvenli dönüş
                yapılacaktır.
              </p>
            </div>
          ) : null}

          <form onSubmit={submitPayment} className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                  Kart ödeme formu
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Kredi / Banka Kartı Bilgileri
                </h2>
              </div>
              <CreditCard className="h-10 w-10 text-[#0a3d62]" />
            </div>

            <div className="mt-6 grid gap-5">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Kart Sahibi Adı
                <input
                  required
                  value={form.holder}
                  onChange={(event) =>
                    updateForm(
                      "holder",
                      event.target.value.toLocaleUpperCase("tr-TR"),
                    )
                  }
                  placeholder="AD SOYAD"
                  className="h-13 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold outline-none ring-[#0a3d62]/20 transition placeholder:text-slate-300 focus:border-[#0a3d62] focus:ring-4"
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Kart Numarası
                <input
                  required
                  inputMode="numeric"
                  maxLength={19}
                  value={form.card}
                  onChange={(event) => updateForm("card", event.target.value)}
                  placeholder="0000 0000 0000 0000"
                  className="h-13 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-base font-semibold tracking-widest outline-none ring-[#0a3d62]/20 transition placeholder:text-slate-300 focus:border-[#0a3d62] focus:ring-4"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  SKT
                  <input
                    required
                    inputMode="numeric"
                    maxLength={5}
                    value={form.expiry}
                    onChange={(event) =>
                      updateForm("expiry", event.target.value)
                    }
                    placeholder="AA/YY"
                    className="h-13 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-base font-semibold outline-none ring-[#0a3d62]/20 transition placeholder:text-slate-300 focus:border-[#0a3d62] focus:ring-4"
                  />
                </label>

                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  CVC
                  <input
                    required
                    inputMode="numeric"
                    maxLength={4}
                    value={form.cvc}
                    onChange={(event) =>
                      updateForm(
                        "cvc",
                        event.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="000"
                    className="h-13 rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-base font-semibold outline-none ring-[#0a3d62]/20 transition placeholder:text-slate-300 focus:border-[#0a3d62] focus:ring-4"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a3d62] px-5 py-4 text-base font-black text-white shadow-xl shadow-blue-950/20 transition hover:bg-[#082f49]"
            >
              <Lock className="h-5 w-5" /> Şimdi Öde
            </button>

            <div className="mt-7 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-3">
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-[#1434cb]">
                VISA Secure
              </div>
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-[#eb001b]">
                Mastercard ID Check
              </div>
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-emerald-700">
                <CheckCircle2 className="h-4 w-4" /> 256-Bit SSL
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
