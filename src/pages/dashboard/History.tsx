import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TranscriptModal } from "@/components/TranscriptModal";
import { toast } from "sonner";
import { Download, Eye, Search, Loader2 } from "lucide-react";

export default function History() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<any[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchCalls();
  }, []);

  useEffect(() => {
    filterCalls();
  }, [calls, searchQuery, sentimentFilter]);

  const fetchCalls = async () => {
    try {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCalls(data || []);
    } catch (error) {
      console.error("Error fetching calls:", error);
      toast.error("Failed to load call history");
    } finally {
      setLoading(false);
    }
  };

  const filterCalls = () => {
    let filtered = [...calls];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (call) =>
          call.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          call.transcript?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sentiment filter
    if (sentimentFilter !== "all") {
      filtered = filtered.filter((call) => call.sentiment === sentimentFilter);
    }

    setFilteredCalls(filtered);
  };

  const exportToCSV = () => {
    const headers = ["Date", "Phone Number", "Duration", "Sentiment", "Topics", "Transcript"];
    const rows = filteredCalls.map((call) => [
      new Date(call.created_at).toLocaleString(),
      call.phone_number || "Unknown",
      `${call.duration}s`,
      call.sentiment || "neutral",
      call.topics?.join("; ") || "",
      call.transcript || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Call history exported to CSV");
  };

  const handleViewTranscript = (call: any) => {
    setSelectedCall(call);
    setModalOpen(true);
  };

  if (roleLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Call History</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              You need admin access to view call history.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Call History & Transcripts</h1>
          <p className="text-muted-foreground mt-2">
            Review customer conversations and insights
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter call records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by phone number or transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sentiment">Sentiment</Label>
              <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Call Records</CardTitle>
          <CardDescription>
            {filteredCalls.length} call{filteredCalls.length !== 1 ? "s" : ""} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Sentiment</TableHead>
                  <TableHead>Topics</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No calls found. Try adjusting your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell>
                        {new Date(call.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{call.phone_number || "Unknown"}</TableCell>
                      <TableCell>{call.duration}s</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            call.sentiment === "positive"
                              ? "default"
                              : call.sentiment === "negative"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {call.sentiment || "neutral"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {call.topics?.slice(0, 2).map((topic: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                          {call.topics?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{call.topics.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewTranscript(call)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <TranscriptModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        call={selectedCall}
      />
    </div>
  );
}
