'use client';

import { useState } from 'react';
import { ACCESS_REQUEST_TITLE } from '@repo/types';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { RequestedProjectKeysField } from '@/components/requested-project-keys-field';

export const CONTACT_SUBJECT_OPTIONS = [
  ACCESS_REQUEST_TITLE,
  'Product feedback',
  'Bug report',
  'Feature request',
  'Account help',
  'Partnership',
  'Other',
] as const;

const OTHER_SUBJECT = 'Other';

type ContactSubjectFieldProps = {
  readonly defaultSubject?: string;
};

export function ContactSubjectField({
  defaultSubject = '',
}: Readonly<ContactSubjectFieldProps>) {
  const [subject, setSubject] = useState(defaultSubject);
  const [otherReason, setOtherReason] = useState('');

  const title = subject === OTHER_SUBJECT ? otherReason.trim() : subject.trim();
  const isAccessRequest =
    subject.trim().toLowerCase() === ACCESS_REQUEST_TITLE.toLowerCase();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
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
            className="h-10 w-full"
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
        <div className="space-y-2">
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
            className="h-10"
            autoComplete="off"
          />
        </div>
      ) : null}

      {isAccessRequest ? <RequestedProjectKeysField /> : null}
    </div>
  );
}
