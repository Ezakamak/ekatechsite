import { FormEvent, useEffect, useState } from "react";
import { ExternalLink, MessageSquare, Star } from "lucide-react";
import { useLanguage } from "../i18n";

type ProjectMessage = {
  id: number;
  message: string;
  sender_name: string;
  sender_email: string;
  sender_role: string;
  created_at?: string;
};

type ProjectLink = {
  id: number;
  label: string;
  url: string;
  created_at?: string;
};

type Feedback = {
  rating: number;
  comment?: string;
  created_at?: string;
};

export function CustomerProjectDetails({ projectId, status }: { projectId: number; status: string }) {
  const { language } = useLanguage();
  const tr = language === "tr";
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const copy = tr
    ? {
        messages: "Proje mesajları",
        links: "Dosya / linkler",
        noMessages: "Henüz proje mesajı yok.",
        noLinks: "Henüz link eklenmedi.",
        feedback: "Müşteri memnuniyeti",
        feedbackHint: "Proje tamamlandıktan sonra deneyimini puanlayabilirsin.",
        comment: "Kısa yorum",
        save: "Puanı kaydet",
        saved: "Değerlendirme kaydedildi.",
      }
    : {
        messages: "Project messages",
        links: "Files / links",
        noMessages: "No project messages yet.",
        noLinks: "No links added yet.",
        feedback: "Customer satisfaction",
        feedbackHint: "You can rate your experience after the project is completed.",
        comment: "Short comment",
        save: "Save rating",
        saved: "Feedback saved.",
      };

  const load = async () => {
    try {
      const response = await fetch(`/api/project-details?projectId=${projectId}`, { credentials: "same-origin" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Details failed");
      setMessages(data?.messages || []);
      setLinks(data?.links || []);
      setFeedback(data?.feedback || null);
      if (data?.feedback?.rating) setRating(Number(data.feedback.rating));
      if (data?.feedback?.comment) setComment(String(data.feedback.comment));
    } catch {
      undefined;
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const submitFeedback = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    try {
      const response = await fetch("/api/project-feedback", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rating, comment }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Feedback failed");
      setNotice({ type: "success", text: data?.message || copy.saved });
      await load();
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Feedback failed" });
    }
  };

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-white">
          <MessageSquare className="h-4 w-4 text-cyan-100" />
          <h4 className="font-medium">{copy.messages}</h4>
        </div>
        <div className="space-y-2">
          {messages.length === 0 && <p className="text-sm text-white/40">{copy.noMessages}</p>}
          {messages.map((message) => (
            <div key={message.id} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-xs text-white/35">{message.sender_name} · {message.sender_role}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/70">{message.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <h4 className="mb-3 font-medium text-white">{copy.links}</h4>
        <div className="space-y-2">
          {links.length === 0 && <p className="text-sm text-white/40">{copy.noLinks}</p>}
          {links.map((link) => (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm text-white/75 hover:bg-white/[0.07]">
              <span>{link.label}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>

      <form onSubmit={submitFeedback} className="rounded-2xl border border-white/10 bg-black/30 p-4 lg:col-span-2">
        <div className="flex items-center gap-2 text-white">
          <Star className="h-4 w-4 text-amber-100" />
          <h4 className="font-medium">{copy.feedback}</h4>
        </div>
        <p className="mt-2 text-sm text-white/40">{copy.feedbackHint}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" onClick={() => setRating(value)} disabled={status !== "completed"} className={`rounded-full px-3 py-2 text-sm font-medium ${rating >= value ? "bg-amber-200 text-black" : "bg-white/[0.06] text-white/45"} disabled:cursor-not-allowed disabled:opacity-50`}>
              ★
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} disabled={status !== "completed"} placeholder={copy.comment} rows={3} className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-white outline-none placeholder:text-white/25 disabled:opacity-50" />
        {notice && <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-100" : "border-red-300/20 bg-red-300/10 text-red-100"}`}>{notice.text}</div>}
        <button type="submit" disabled={status !== "completed"} className="mt-3 rounded-full bg-white px-5 py-3 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50">
          {feedback ? copy.saved : copy.save}
        </button>
      </form>
    </div>
  );
}
