'use client';

import { useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';

export const CONTACT_SUBJECT_OPTIONS = [
  'Access request',
  'Product feedback',
  'Bug report',
  'Feature request',
  'Account help',
  'Partnership',
  'Other',
] as const;

const OTHER_SUBJECT = 'Other';

export function ContactSubjectField() {
  const [subject, setSubject] = useState('');
  const [otherReason, setOtherReason] = useState('');

  const title = subject === OTHER_SUBJECT ? otherReason.trim() : subject.trim();

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label htmlFor="contact-subject">Reason</Label>
        <Select
          value={subject}
          onValueChange={(value) => {
            setSubject(value);
            if (value !== OTHER_SUBJECT) {
              setOtherReason('');
            }
          }}
        >
          <SelectTrigger
            id="contact-subject"
            className="h-11 w-full"
            aria-label="Reason for contacting"
          >
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_SUBJECT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="title" value={title} />
      </div>

      {subject === OTHER_SUBJECT ? (
        <div className="space-y-3">
          <Label htmlFor="subjectOther">Tell us the reason</Label>
          <Input
            id="subjectOther"
            name="subjectOther"
            type="text"
            required
            maxLength={200}
            value={otherReason}
            onChange={(event) => setOtherReason(event.target.value)}
            placeholder="Describe your reason"
            className="h-11"
            autoComplete="off"
          />
        </div>
      ) : null}
    </div>
  );
}
