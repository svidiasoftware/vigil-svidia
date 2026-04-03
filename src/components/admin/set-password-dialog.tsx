"use client";

import { useState } from "react";
import { setUserPassword } from "@/app/(authenticated)/admin/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Profile } from "@/types";

interface SetPasswordDialogProps {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SetPasswordDialog({
  profile,
  open,
  onOpenChange,
}: SetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function reset() {
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  }

  function handleOpenChange(open: boolean) {
    if (!open) reset();
    onOpenChange(open);
  }

  async function handleSave() {
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    const result = await setUserPassword(profile.id, password);
    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set Password</DialogTitle>
          <DialogDescription>{profile.display_name}</DialogDescription>
        </DialogHeader>

        {success ? (
          <p className="text-sm text-green-600 dark:text-green-400 py-2">
            Password updated successfully.
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                New password
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Confirm password
              </label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button size="sm" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !password || !confirm}
            >
              {saving ? "Saving..." : "Set Password"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
