"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
    name: z.string().optional(),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    type: z.enum(["bug", "feature_request", "general", "other"]),
    message: z.string().min(5, {
        message: "Message must be at least 5 characters.",
    }),
});


import { useTranslations } from "next-intl";

export function FeedbackForm() {
    const t = useTranslations('Feedback');
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const supabase = createClient();

    // Define schema with translations
    const formSchema = z.object({
        name: z.string().optional(),
        email: z.string()
            .email(t('labels.email') + " invalid") // Simple fallback or add validation key
            .optional()
            .or(z.literal("")),
        type: z.enum(["bug", "feature_request", "general", "other"]),
        message: z.string().min(5, {
            message: t('error'), // Reusing error or need specific "too short" key. Let's use generic for now or add one.
        }),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            message: "",
            type: "general",
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            // 1. Store in Database
            const { error: dbError } = await supabase.from("feedback").insert({
                name: values.name || null,
                email: values.email || null,
                message: values.message,
                feedback_type: values.type,
                status: "new",
            });

            if (dbError) {
                throw dbError;
            }

            // 2. Send Email Notification
            const { error: fnError } = await supabase.functions.invoke('send-feedback', {
                body: values,
            });

            if (fnError) {
                console.error("Failed to send email notification:", fnError);
            }

            toast.success(t('success'));
            setOpen(false);
            form.reset();
        } catch (error) {
            console.error("Error sending feedback:", error);
            toast.error(t('error'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    {t('button')}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription>
                        {t('description')}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('labels.name')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('placeholders.name')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>{t('labels.email')}</FormLabel>
                                        <FormControl>
                                            <Input placeholder={t('placeholders.email')} {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('labels.type')}</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder={t('placeholders.type')} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="bug">{t('types.bug')}</SelectItem>
                                            <SelectItem value="feature_request">{t('types.feature')}</SelectItem>
                                            <SelectItem value="general">{t('types.general')}</SelectItem>
                                            <SelectItem value="other">{t('types.other')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('labels.message')}</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={t('placeholders.message')}
                                            className="resize-none text-start"
                                            rows={4}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('submit')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
