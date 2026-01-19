'use client';

import { useState } from 'react';
import { QuestionRequest, Question, QuestionOption } from '@/lib/types/execution';
import { HelpCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface QuestionDialogProps {
  request: QuestionRequest;
  onSubmit: (answers: Record<string, string>) => void;
  isOpen: boolean;
}

interface QuestionAnswerState {
  selectedOptions: Set<string>;  // For multi-select
  selectedOption: string | null;  // For single-select
  customAnswer: string;  // For "Other" input
  useCustom: boolean;  // Whether "Other" is selected
}

export function QuestionDialog({
  request,
  onSubmit,
  isOpen,
}: QuestionDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Initialize answer state for each question
  const [answers, setAnswers] = useState<Record<number, QuestionAnswerState>>(() => {
    const initial: Record<number, QuestionAnswerState> = {};
    request.questions.forEach((_, index) => {
      initial[index] = {
        selectedOptions: new Set(),
        selectedOption: null,
        customAnswer: '',
        useCustom: false,
      };
    });
    return initial;
  });

  const updateAnswer = (questionIndex: number, updates: Partial<QuestionAnswerState>) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: { ...prev[questionIndex], ...updates }
    }));
  };

  const handleSubmit = async () => {
    setIsProcessing(true);

    // Build the answers object in SDK format
    const formattedAnswers: Record<string, string> = {};

    request.questions.forEach((question, index) => {
      const state = answers[index];

      if (state.useCustom) {
        // User provided custom answer
        formattedAnswers[question.question] = state.customAnswer || '';
      } else if (question.multiSelect) {
        // Multi-select: join labels with ", "
        const labels = Array.from(state.selectedOptions);
        formattedAnswers[question.question] = labels.join(', ');
      } else {
        // Single-select: use the selected label
        formattedAnswers[question.question] = state.selectedOption || '';
      }
    });

    await onSubmit(formattedAnswers);
    setIsProcessing(false);
  };

  // Check if all questions have been answered
  const allAnswered = request.questions.every((question, index) => {
    const state = answers[index];
    if (state.useCustom) {
      return state.customAnswer.trim().length > 0;
    }
    if (question.multiSelect) {
      return state.selectedOptions.size > 0;
    }
    return state.selectedOption !== null;
  });

  return (
    <Dialog open={isOpen}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            Claude needs your input
          </DialogTitle>
          <DialogDescription>
            Please answer the following {request.questions.length === 1 ? 'question' : 'questions'} to help Claude proceed
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {request.questions.map((question, questionIndex) => (
            <div key={questionIndex} className="space-y-3">
              {/* Question header */}
              <div>
                <div className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded mb-2">
                  {question.header}
                </div>
                <h3 className="text-sm font-semibold text-foreground">
                  {question.question}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2">
                {question.multiSelect ? (
                  // Multi-select checkboxes
                  <>
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                      >
                        <Checkbox
                          id={`q${questionIndex}-opt${optionIndex}`}
                          checked={answers[questionIndex].selectedOptions.has(option.label)}
                          onCheckedChange={(checked) => {
                            const newSet = new Set(answers[questionIndex].selectedOptions);
                            if (checked) {
                              newSet.add(option.label);
                            } else {
                              newSet.delete(option.label);
                            }
                            updateAnswer(questionIndex, {
                              selectedOptions: newSet,
                              useCustom: false,
                            });
                          }}
                          disabled={answers[questionIndex].useCustom}
                        />
                        <label
                          htmlFor={`q${questionIndex}-opt${optionIndex}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-sm text-foreground">
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {option.description}
                          </div>
                        </label>
                      </div>
                    ))}
                  </>
                ) : (
                  // Single-select radio buttons
                  <RadioGroup
                    value={answers[questionIndex].selectedOption || ''}
                    onValueChange={(value) => {
                      updateAnswer(questionIndex, {
                        selectedOption: value,
                        useCustom: false,
                      });
                    }}
                    disabled={answers[questionIndex].useCustom}
                  >
                    {question.options.map((option, optionIndex) => (
                      <div
                        key={optionIndex}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                      >
                        <RadioGroupItem
                          value={option.label}
                          id={`q${questionIndex}-opt${optionIndex}`}
                          disabled={answers[questionIndex].useCustom}
                        />
                        <label
                          htmlFor={`q${questionIndex}-opt${optionIndex}`}
                          className="flex-1 cursor-pointer"
                        >
                          <div className="font-medium text-sm text-foreground">
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {option.description}
                          </div>
                        </label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {/* Custom "Other" input */}
                <div className="space-y-2 mt-3 pt-3 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`q${questionIndex}-custom`}
                      checked={answers[questionIndex].useCustom}
                      onCheckedChange={(checked) => {
                        updateAnswer(questionIndex, {
                          useCustom: !!checked,
                          selectedOption: checked ? null : answers[questionIndex].selectedOption,
                          selectedOptions: checked ? new Set() : answers[questionIndex].selectedOptions,
                        });
                      }}
                    />
                    <Label
                      htmlFor={`q${questionIndex}-custom`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      Other (specify your own answer)
                    </Label>
                  </div>
                  {answers[questionIndex].useCustom && (
                    <Input
                      placeholder="Type your answer here..."
                      value={answers[questionIndex].customAnswer}
                      onChange={(e) => {
                        updateAnswer(questionIndex, {
                          customAnswer: e.target.value,
                        });
                      }}
                      className="mt-2"
                      autoFocus
                    />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || !allAnswered}
            className="gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Submit {request.questions.length > 1 ? 'Answers' : 'Answer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
