import { h } from '../dom.js';
import { formatDate, formatMoney, pluralize } from '../format.js';
import { vendorStats } from '../progress.js';

function createVendorSummary(vendor, count, money, locale) {
  return h(
    'summary',
    {},
    h('span', { class: 'vendor-name', text: vendor.label }),
    vendor.essential ? h('span', { class: 'badge', text: 'Essential' }) : null,
    vendor.priority ? h('span', { class: 'badge badge-accent', text: 'Priority' }) : null,
    h('span', { class: 'vendor-meta', text: `Budget ${money(vendor.budget)} - book by ${formatDate(vendor.bookBy, locale)}` }),
    count,
  );
}

function createVendorBody(steps, questions) {
  return h(
    'div',
    { class: 'vendor-body' },
    h('h4', { text: 'Checklist' }),
    h('ul', { class: 'plain-list' }, steps),
    h('h4', { text: 'Questions to ask' }),
    h('ul', { class: 'bullet-list' }, questions.map((question) => h('li', { text: question }))),
  );
}

function createStepItem(vendorLabel, step, isChecked, onToggle) {
  const checkbox = h('input', {
    type: 'checkbox',
    checked: isChecked,
    'aria-label': `${vendorLabel}: ${step.text}`,
  });
  checkbox.addEventListener('change', () => onToggle(step.id, checkbox.checked));
  return h('li', {}, h('label', { class: 'check-label' }, checkbox, h('span', { text: step.text })));
}

function createChecklist(vendor, currentSteps, onToggle) {
  return vendor.checklist.map((step) =>
    createStepItem(vendor.label, step, currentSteps[step.id] === true, onToggle),
  );
}

export function createVendorsView({ plan, progress, locale, onToggleStep }) {
  const money = (amount) => formatMoney(amount, plan.budget.currency, locale);
  let current = progress;

  function toggleStep(stepId, checked, paint) {
    const updated = { ...current.steps };
    if (checked) updated[stepId] = true;
    else delete updated[stepId];
    current = { ...current, steps: updated };
    paint();
    onToggleStep(stepId, checked);
  }

  function createVendor(vendor) {
    const count = h('span', { class: 'vendor-progress' });
    const paint = () => {
      const stats = vendorStats(vendor, current);
      count.textContent = `${stats.done} of ${pluralize(stats.total, 'step')} done`;
    };
    const onToggle = (stepId, checked) => toggleStep(stepId, checked, paint);
    const steps = createChecklist(vendor, current.steps, onToggle);
    paint();
    const summary = createVendorSummary(vendor, count, money, locale);
    const body = createVendorBody(steps, vendor.questions);
    return h('details', { class: 'vendor' }, summary, body);
  }

  const element = h(
    'div',
    { class: 'vendors-view' },
    h('h3', { text: 'Vendor checklist' }),
    h('p', {
      class: 'section-intro',
      text: 'Vendors are ordered by how early they usually need to be booked. Open a vendor to see its steps and questions.',
    }),
    plan.vendors.map(createVendor),
  );

  return { element };
}
