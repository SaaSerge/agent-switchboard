import { Layout } from "@/components/Layout";
import { useRequests } from "@/hooks/use-requests";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "wouter";
import { Eye } from "lucide-react";

export default function Requests() {
  const { requests, isLoading } = useRequests();

  return (
    <Layout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Action Requests</h1>
          <p className="text-muted-foreground mt-1">Audit trail of all agent operations</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map((req) => (
              <TableRow key={req.id} className="hover:bg-white/5 transition-colors group">
                <TableCell className="font-mono text-xs text-muted-foreground">#{req.id}</TableCell>
                <TableCell className="font-medium text-primary-foreground">{req.agentName}</TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground group-hover:text-foreground transition-colors">
                  {req.summary}
                </TableCell>
                <TableCell>
                  <StatusBadge status={req.status} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/requests/${req.id}`}>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all cursor-pointer">
                      <Eye className="w-4 h-4" />
                    </span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && requests?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No requests found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Layout>
  );
}
