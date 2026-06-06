"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Users, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClassItem {
  _id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  price: number;
  maxStudents: number;
  enrolledStudents: string[];
  status: string;
}

const defaultForm = { title: "", subject: "", description: "", date: "", startTime: "", endTime: "", price: 15, maxStudents: 10 };

export default function TeacherClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/classes");
    setClasses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  function update(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startTime, endTime }),
      });
      if (!res.ok) throw new Error();
      toast.success("Class created");
      setForm(defaultForm);
      setOpen(false);
      fetchClasses();
    } catch {
      toast.error("Failed to create class");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Classes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 me-2" />New Class
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create a Group Class</DialogTitle></DialogHeader>
            <form onSubmit={createClass} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1"><Label>Title</Label><Input required value={form.title} onChange={(e) => update("title", e.target.value)} /></div>
                <div className="space-y-1"><Label>Subject</Label><Input required value={form.subject} onChange={(e) => update("subject", e.target.value)} /></div>
                <div className="space-y-1"><Label>Price (USD)</Label><Input type="number" min={1} value={form.price} onChange={(e) => update("price", parseFloat(e.target.value))} /></div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" required value={form.date} onChange={(e) => update("date", e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
                <div className="space-y-1"><Label>Max Students</Label><Input type="number" min={2} max={50} value={form.maxStudents} onChange={(e) => update("maxStudents", parseInt(e.target.value))} /></div>
                <div className="space-y-1"><Label>Start Time</Label><Input type="time" required value={form.startTime} onChange={(e) => update("startTime", e.target.value)} /></div>
                <div className="space-y-1"><Label>End Time</Label><Input type="time" required value={form.endTime} onChange={(e) => update("endTime", e.target.value)} /></div>
                <div className="col-span-2 space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} /></div>
              </div>
              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}Create Class
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No classes yet. Create your first group class!</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls._id} className="hover:shadow-md transition-shadow">
              <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{cls.title}</CardTitle>
                  <Badge variant={cls.status === "open" ? "default" : "secondary"}>{cls.status}</Badge>
                </div>
                <Badge variant="outline" className="w-fit">{cls.subject}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{format(new Date(cls.startTime), "PPP")} · {format(new Date(cls.startTime), "HH:mm")} – {format(new Date(cls.endTime), "HH:mm")}</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4" />{cls.enrolledStudents.length}/{cls.maxStudents} students · ${cls.price}/student</p>
                {/* Enrollment bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(cls.enrolledStudents.length / cls.maxStudents) * 100}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
