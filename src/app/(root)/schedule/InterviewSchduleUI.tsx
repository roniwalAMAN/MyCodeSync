import { useUser } from "@clerk/nextjs";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DialogHeader, Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@radix-ui/react-select";
import UserInfo from "@/components/UserInfo";
import { XIcon } from "lucide-react";
function InterviewScheduleUI() {
    const client = useStreamVideoClient();
    const { user } = useUser();
    const [open, setOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const interviews = useQuery(api.interviews.getAllInterviews) ?? [];
    const users = useQuery(api.users.getUsers) ?? [];
    const createInterview = useMutation(api.interviews.createInterview);

    const candidates = users?.filter((u) => u.role === "candidate");
    const interviewers = users?.filter((u) => u.role === "interviewer");

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        date: new Date(),
        time: "09:00",
        candidateId: "",
        interviewerIds: user?.id ? [user.id] : [],
    });
    const scheduleMeeting = async () => {
        if (!client || !user) return;
        if (!formData.candidateId || formData.interviewerIds.length === 0) {
            toast.error("Please select both candidate and at least one interviewer");
            return;
        }

        setIsCreating(true);

        try {
            const { title, description, date, time, candidateId, interviewerIds } = formData;
            const [hours, minutes] = time.split(":");
            const meetingDate = new Date(date);
            meetingDate.setHours(parseInt(hours), parseInt(minutes), 0);

            const id = crypto.randomUUID();
            const call = client.call("default", id);

            await call.getOrCreate({
                data: {
                    starts_at: meetingDate.toISOString(),
                    custom: {
                        description: title,
                        additionalDetails: description,
                    },
                },
            });

            await createInterview({
                title,
                description,
                startTime: meetingDate.getTime(),
                status: "upcoming",
                streamCallId: id,
                candidateId,
                interviewerIds,
            });

            setOpen(false);
            toast.success("Meeting scheduled successfully!");

            setFormData({
                title: "",
                description: "",
                date: new Date(),
                time: "09:00",
                candidateId: "",
                interviewerIds: user?.id ? [user.id] : [],
            });
        } catch (error) {
            console.error(error);
            toast.error("Failed to schedule meeting. Please try again.");
        } finally {
            setIsCreating(false);
        }
    };
    const addInterviewer = (interviewerId: string) => {
        if (!formData.interviewerIds.includes(interviewerId)) {
            setFormData((prev) => ({
                ...prev,
                interviewerIds: [...prev.interviewerIds, interviewerId],
            }));
        }
    };
    const removeInterviewer = (interviewerId: string) => {
        if (interviewerId === user?.id) return;
        setFormData((prev) => ({
            ...prev,
            interviewerIds: prev.interviewerIds.filter((id) => id !== interviewerId),
        }));
    };

    const selectedInterviewers = interviewers.filter((i) =>
        formData.interviewerIds.includes(i.clerkId)
    );

    const availableInterviewers = interviewers.filter(
        (i) => !formData.interviewerIds.includes(i.clerkId)
    );

    return (
        <div className="container max-w-7xl mx-auto p-6 space-y-8">
            <div className="flex items-center justify-between">
                {/* HEADER INFO */}
                <div>
                    <h1 className="text-3xl font-bold">Interviews</h1>
                    <p className="text-muted-foreground mt-1">Schedule and manage interviews</p>
                </div>

                {/* DIALOG */}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="lg">Schedule Interview</Button>
                    </DialogTrigger>

                    <DialogContent className="sm:max-w-[500px] h-[calc(100vh-200px)] overflow-auto">
            <DialogHeader>
              <DialogTitle>Schedule Interview</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* INTERVIEW TITLE */}

              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Interview title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              {/* INTERVIEW DESC */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Interview description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* CANDIDATE */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Candidate</label>
                <Select
                  value={formData.candidateId}
                  onValueChange={(candidateId) => setFormData({ ...formData, candidateId })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((candidate) => (
                      <SelectItem key={candidate.clerkId} value={candidate.clerkId}>
                        <UserInfo user={candidate} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* INTERVIEWERS */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Interviewers</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedInterviewers.map((interviewer) => (
                    <div
                      key={interviewer.clerkId}
                      className="inline-flex items-center gap-2 bg-secondary px-2 py-1 rounded-md text-sm"
                    >
                      <UserInfo user={interviewer} />
                      {interviewer.clerkId !== user?.id && (
                        <button
                          onClick={() => removeInterviewer(interviewer.clerkId)}
                          className="hover:text-destructive transition-colors"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {availableInterviewers.length > 0 && (
                  <Select onValueChange={addInterviewer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add interviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInterviewers.map((interviewer) => (
                        <SelectItem key={interviewer.clerkId} value={interviewer.clerkId}>
                          <UserInfo user={interviewer} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>



              </div>
                    </DialogContent>

                </Dialog>
            </div>
        </div>
    );

}
export default InterviewScheduleUI;