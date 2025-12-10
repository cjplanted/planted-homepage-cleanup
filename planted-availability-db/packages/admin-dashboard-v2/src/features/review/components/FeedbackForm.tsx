/**
 * FeedbackForm Component
 *
 * Form for submitting feedback with text area and quick tag buttons.
 * Used for both partial approval and rejection.
 */

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/lib/utils';
import { FEEDBACK_TAGS, REJECTION_REASONS } from '../types';

interface FeedbackFormProps {
  type: 'partial' | 'reject';
  onSubmit: (feedback: string, tags: string[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

/**
 * FeedbackForm Component
 */
export function FeedbackForm({
  type,
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: FeedbackFormProps) {
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = type === 'partial' ? FEEDBACK_TAGS : REJECTION_REASONS;
  const title = type === 'partial' ? 'Partial Approval Feedback' : 'Rejection Reason';
  const placeholder =
    type === 'partial'
      ? 'Provide detailed feedback about what needs to be corrected...'
      : 'Explain why this venue is being rejected...';

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (feedback.trim()) {
      onSubmit(feedback, selectedTags);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {type === 'partial'
            ? 'Select issues and provide feedback for AI training'
            : 'Select a reason and provide details for rejection'}
        </p>
      </div>

      {/* Quick Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Quick Tags</label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Feedback Text Area */}
      <div className="space-y-2">
        <label htmlFor="feedback" className="text-sm font-medium">
          Detailed Feedback
        </label>
        <textarea
          id="feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={placeholder}
          rows={6}
          required
          className={cn(
            'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-none'
          )}
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground">
          {feedback.length} characters
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={!feedback.trim() || isLoading}
          className="flex-1"
        >
          {isLoading ? 'Submitting...' : 'Submit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
