import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ROWS = [
  ["32B", "28–30", "33–34"], ["34B", "30–32", "35–36"], ["34C", "30–32", "36–37"], ["36B", "32–34", "37–38"],
  ["36C", "32–34", "38–39"], ["38C", "34–36", "40–41"], ["38D", "34–36", "41–42"],
];

export function SizeGuide() {
  return (
    <Dialog>
      <DialogTrigger className="text-xs font-semibold text-primary underline">Size Guide</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Bra size guide (inches)</DialogTitle></DialogHeader>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="py-2">Size</th><th>Under bust</th><th>Over bust</th></tr></thead>
          <tbody>{ROWS.map(([s, u, o]) => <tr key={s} className="border-b"><td className="py-2 font-semibold">{s}</td><td>{u}</td><td>{o}</td></tr>)}</tbody>
        </table>
        <p className="text-xs text-muted-foreground">Measure snugly under the bust for the band, and around the fullest part for the cup. Panties & nightwear use S–XXL.</p>
      </DialogContent>
    </Dialog>
  );
}
