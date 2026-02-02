import { cn } from "@/lib/utils";

export function CodeBlock({ code, language = "json", className }: { code: string | object, language?: string, className?: string }) {
  const content = typeof code === 'object' ? JSON.stringify(code, null, 2) : code;
  
  return (
    <div className={cn("relative rounded-lg overflow-hidden bg-[#0D1117] border border-border group", className)}>
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-[10px] uppercase text-muted-foreground font-mono bg-white/5 px-2 py-0.5 rounded">
          {language}
        </div>
      </div>
      <pre className="p-4 overflow-x-auto text-xs md:text-sm font-mono text-gray-300">
        <code>{content}</code>
      </pre>
    </div>
  );
}
