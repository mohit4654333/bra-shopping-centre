import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Msg = { id: string; sender: string; body: string; created_at: string };
const KEY = "gb_chat_session";

export function ChatWidget({ brand }: { brand: string }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState("");
  const [name, setName] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let s = localStorage.getItem(KEY);
    if (!s) { s = crypto.randomUUID(); localStorage.setItem(KEY, s); }
    setSession(s);
    setName(localStorage.getItem(KEY + "_name") ?? "");
  }, []);

  useEffect(() => {
    if (!open || !session) return;
    const load = async () => {
      const { data } = await supabase.rpc("get_chat_thread", { _session: session });
      if (data) setMsgs(data as Msg[]);
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [open, session]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    const body = text.trim().slice(0, 1000);
    if (!body) return;
    setText("");
    localStorage.setItem(KEY + "_name", name);
    setMsgs((m) => [...m, { id: "tmp" + Date.now(), sender: "customer", body, created_at: new Date().toISOString() }]);
    await supabase.from("chat_messages").insert({ session_id: session, customer_name: name.trim().slice(0, 60), sender: "customer", body });
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center bg-primary px-4 py-3 text-primary-foreground">
            <div><p className="font-semibold">{brand} Support</p><p className="text-xs opacity-80">We usually reply in a few minutes</p></div>
            <button type="button" aria-label="Close chat" onClick={() => setOpen(false)} className="ml-auto"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-3 text-sm">
            <p className="rounded-xl bg-card p-2 shadow-sm">Namaste! 👋 Size, order ya payment — kuch bhi poochiye.</p>
            {msgs.map((m) => (
              <p key={m.id} className={`max-w-[85%] rounded-xl p-2 shadow-sm ${m.sender === "customer" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}>{m.body}</p>
            ))}
            <div ref={end} />
          </div>
          {!name && msgs.length === 0 && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className="border-t px-3 py-2 text-sm outline-none" />
          )}
          <form className="flex border-t" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" className="flex-1 bg-transparent px-3 py-3 text-sm outline-none" />
            <button type="submit" aria-label="Send" className="px-3 text-primary"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      )}
      <button type="button" aria-label="Chat with us" onClick={() => setOpen(!open)} className="ml-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition hover:scale-105">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
