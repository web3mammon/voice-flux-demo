import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, CreditCard, TrendingUp } from "lucide-react";
import { toast } from "sonner";

// Demo data for MVP
const currentPlan = {
  name: "Enterprise",
  price: "$200,000/year",
  billingDate: "December 1, 2025",
  paymentMethod: "•••• •••• •••• 4242",
};

const usageStats = {
  totalCalls: 2347,
  totalMinutes: 8923,
  phoneNumbers: 3,
  phoneNumberCost: 15,
  addOns: 0,
};

const dailyCallData = [
  { date: "Nov 1", calls: 78 },
  { date: "Nov 2", calls: 82 },
  { date: "Nov 3", calls: 91 },
  { date: "Nov 4", calls: 76 },
  { date: "Nov 5", calls: 85 },
  { date: "Nov 6", calls: 94 },
  { date: "Nov 7", calls: 88 },
];

const invoices = [
  { id: "INV-2024-11", date: "Nov 1, 2024", amount: "$16,666.67", status: "Paid" },
  { id: "INV-2024-10", date: "Oct 1, 2024", amount: "$16,666.67", status: "Paid" },
  { id: "INV-2024-09", date: "Sep 1, 2024", amount: "$16,666.67", status: "Paid" },
  { id: "INV-2024-08", date: "Aug 1, 2024", amount: "$16,666.67", status: "Paid" },
  { id: "INV-2024-07", date: "Jul 1, 2024", amount: "$16,666.67", status: "Paid" },
];

export default function Billing() {
  const handleDownloadInvoice = (invoiceId: string) => {
    toast.success(`Downloading ${invoiceId}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Usage & Billing</h1>
        <p className="text-muted-foreground mt-2">
          Track your usage and manage billing
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </div>
            <Badge className="text-lg px-4 py-2">{currentPlan.name}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Plan Price</p>
              <p className="text-2xl font-bold">{currentPlan.price}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Billing Date</p>
              <p className="text-lg font-medium">{currentPlan.billingDate}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Method</p>
              <div className="flex items-center gap-2 mt-1">
                <CreditCard className="h-4 w-4" />
                <p className="text-lg font-medium">{currentPlan.paymentMethod}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage This Month */}
      <Card>
        <CardHeader>
          <CardTitle>Usage This Month</CardTitle>
          <CardDescription>November 2024</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Calls</p>
              <p className="text-3xl font-bold">{usageStats.totalCalls.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Minutes</p>
              <p className="text-3xl font-bold">{usageStats.totalMinutes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone Numbers</p>
              <p className="text-3xl font-bold">{usageStats.phoneNumbers}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Additional Costs</p>
              <p className="text-3xl font-bold">${usageStats.phoneNumberCost}</p>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h4 className="font-semibold">Cost Breakdown</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Voice AI (Unlimited)</span>
                <span className="font-medium">Included</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Phone Numbers (3 × $5/mo)</span>
                <span className="font-medium">${usageStats.phoneNumberCost}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Optional Add-ons</span>
                <span className="font-medium">${usageStats.addOns}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t">
                <span>Total Additional Charges</span>
                <span>${usageStats.phoneNumberCost + usageStats.addOns}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Trends */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Usage Trends (Last 7 Days)</CardTitle>
          </div>
          <CardDescription>Daily call volume</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dailyCallData.map((item) => (
              <div key={item.date} className="flex items-center gap-4">
                <span className="w-16 text-sm font-medium">{item.date}</span>
                <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                  <div
                    className="bg-primary h-full flex items-center justify-end pr-2"
                    style={{ width: `${(item.calls / 100) * 100}%` }}
                  >
                    <span className="text-xs font-medium text-primary-foreground">
                      {item.calls} calls
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Download past invoices and receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{invoice.date}</TableCell>
                    <TableCell>{invoice.amount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(invoice.id)}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
