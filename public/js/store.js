// Saves the plan and progress in the browser. Storage can be missing, full or
// blocked, and its contents can be edited by the user, so every read is
// validated and every failure is silent.

import { emptyProgress, reconcileProgress } from './progress.js';

export const STORAGE_KEY = 'celebration-planner:v1';
const SCHEMA_VERSION = 1;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string';

function isLineShape(line) {
  return isObject(line) && isText(line.key) && isText(line.label) && Number.isFinite(line.amount) && Number.isFinite(line.share);
}

function isTaskShape(task) {
  return isObject(task) && isText(task.id) && isText(task.title) && isText(task.detail) && isText(task.dueDate) && isText(task.phase);
}

function isVendorShape(vendor) {
  return (
    isObject(vendor) &&
    isText(vendor.key) &&
    isText(vendor.label) &&
    isText(vendor.bookBy) &&
    Number.isFinite(vendor.budget) &&
    Array.isArray(vendor.checklist) &&
    vendor.checklist.every((step) => isObject(step) && isText(step.id) && isText(step.text)) &&
    Array.isArray(vendor.questions) &&
    vendor.questions.every(isText)
  );
}

function isIdeaShape(idea) {
  return isObject(idea) && isText(idea.title) && isText(idea.detail) && isText(idea.category);
}

function isInputShape(input) {
  return (
    isObject(input) &&
    isText(input.eventName) &&
    isText(input.eventDate) &&
    isText(input.eventType) &&
    isText(input.currency) &&
    Number.isFinite(input.guestCount)
  );
}

function isSummaryShape(summary) {
  return isObject(summary) && Number.isFinite(summary.daysUntilEvent) && Number.isFinite(summary.budgetPerGuest);
}

function isBudgetShape(budget) {
  return isObject(budget) && Number.isFinite(budget.total) && Array.isArray(budget.lines) && budget.lines.every(isLineShape);
}

function isTimelineShape(timeline) {
  return isObject(timeline) && Array.isArray(timeline.tasks) && timeline.tasks.every(isTaskShape);
}

function isVendorsShape(vendors) {
  return Array.isArray(vendors) && vendors.every(isVendorShape);
}

function isIdeasShape(ideas) {
  return isObject(ideas) && Array.isArray(ideas.items) && ideas.items.every(isIdeaShape);
}

export function isPlanShape(plan) {
  return (
    isObject(plan) &&
    isInputShape(plan.input) &&
    isText(plan.eventTypeLabel) &&
    isSummaryShape(plan.summary) &&
    isBudgetShape(plan.budget) &&
    isTimelineShape(plan.timeline) &&
    isVendorsShape(plan.vendors) &&
    isIdeasShape(plan.ideas)
  );
}

export function createStore(storage) {
  function load() {
    if (!storage) return null;
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY));
      if (!isObject(saved) || saved.version !== SCHEMA_VERSION || !isPlanShape(saved.plan)) return null;
      return { plan: saved.plan, progress: reconcileProgress(saved.progress, saved.plan) };
    } catch {
      return null;
    }
  }

  function save({ plan, progress }) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, plan, progress: progress ?? emptyProgress() }));
      return true;
    } catch {
      return false;
    }
  }

  function clear() {
    if (!storage) return;
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // Nothing useful can be done if storage is unavailable.
    }
  }

  return { load, save, clear };
}

export function browserStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
