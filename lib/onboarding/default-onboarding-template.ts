import type { TemplateMeta, TemplateStep } from '@/lib/onboarding/types';

/** Pre-kickoff boundary: divider renders after step index 2 (Roles & Permissions). */
export const CANONICAL_ONBOARDING_TEMPLATE_META: TemplateMeta = {
  kickoffDividerAfterStepIndex: 2,
};

/**
 * Canonical onboarding checklist steps (spaces CSV upload, kickoff split, no emoji icons).
 * Keep in sync with supabase/migrations that sync default templates.
 */
export const CANONICAL_ONBOARDING_TEMPLATE_STEPS: TemplateStep[] = [
  {
    title: 'Understand the Back Office',
    time: '~3 min',
    description:
      "Before diving into setup, spend a few minutes getting oriented with how Bond's back office is organized. Understanding the main navigation will make every step below much faster.",
    links: [
      {
        label: 'Back Office Overview',
        url: 'https://help.bondsports.co/en/collections/11612167-getting-started',
        icon: 'Book',
      },
    ],
    doneWhen: "Done when you've watched the overview and can find the main nav sections.",
  },
  {
    title: 'Connect Your Bank Account',
    time: '~5 min',
    description:
      'This is what allows you to start collecting payments from customers. Get this done first so everything else can be tested end to end.',
    links: [
      {
        label: 'Watch setup video',
        url: 'https://jam.dev/c/b1815fb9-2d82-46ed-b75b-8416566440ec',
        icon: 'Video',
      },
    ],
    doneWhen: 'Done when your bank account shows as connected in Settings.',
  },
  {
    title: 'Set Up Roles & Permissions',
    time: '~10 min',
    description:
      'Control what each member of your staff can access and do in Bond. This step directly impacts both daily operations and account security.',
    links: [
      {
        label: 'Roles & Permissions Guide',
        url: 'https://help.bondsports.co/en/articles/10128365-roles-permissions',
        icon: 'Guide',
      },
    ],
    note: 'Important: Incorrect permissions can affect security and daily operations. Take a few extra minutes to assign roles carefully.',
    checklist: ['Add all employees to the system', 'Assign the correct role to each person'],
    doneWhen: 'Done when all staff are added and roles are assigned.',
  },
  {
    title: 'Configure Your Tax Rates',
    time: '~5 min',
    description:
      "Set how taxes are applied to your products. You'll want this in place before creating any rentals or programs.",
    links: [
      {
        label: 'Open Tax Settings',
        url: 'https://backoffice.bondsports.co/client/settings#/organization/taxes/tax-rates',
        icon: 'Settings',
      },
    ],
    checklist: ['Exclusive tax, added on top of product price', 'Inclusive tax, built into the product price'],
    doneWhen: 'Done when your tax rates are saved in Settings.',
  },
  {
    title: 'Set Up Accounting Codes',
    time: '~5 min',
    description:
      'Set up your accounting codes before creating any products. This keeps your reporting organized from the start and avoids having to remap codes later.',
    links: [
      {
        label: 'Accounting Codes Guide',
        url: 'https://help.bondsports.co/en/articles/12968674-accounting-codes',
        icon: 'Guide',
      },
    ],
    doneWhen: 'Done when your accounting codes are created and ready to assign.',
  },
  {
    title: 'List Your Rentable Spaces',
    time: '~10 min',
    description:
      'Use the CSV template to list courts, fields, ice time, cages, rooms, or any rentable spaces at your facility. Download the template, fill in your rows, and upload your file below. Bond will use this file during onboarding and setup.',
    links: [
      {
        label: 'Setting Up Rental Products (help)',
        url: 'https://help.bondsports.co/en/articles/11021853-setting-up-rental-products',
        icon: 'Guide',
      },
      {
        label: 'Rental Reservations Overview',
        url: 'https://help.bondsports.co/en/articles/11403275-rental-reservations-overview',
        icon: 'Guide',
      },
    ],
    spacesCsvUpload: true,
    doneWhen: 'Done when you have uploaded your spaces CSV and reviewed it for accuracy.',
  },
  {
    title: 'Set Up Programs (Registrations)',
    time: '~10 min',
    description:
      'Use programs for classes, leagues, camps, clinics, and training sessions — anything that requires participant registration rather than a simple rental booking.',
    links: [
      {
        label: 'Programs Getting Started Guide',
        url: 'https://help.bondsports.co/en/articles/11060636-getting-started',
        icon: 'Guide',
      },
    ],
    note: 'Your Bond onboarding specialist will walk through program setup in detail on your training call. This step is here to help you get familiar beforehand.',
    doneWhen: "Done when you've reviewed the guide and are ready for your training call.",
  },
  {
    title: 'Set Up Forms & Waivers',
    time: '~5 min',
    description:
      'Collect important participant information, waivers, and custom questionnaires — attached directly to your products and programs.',
    links: [
      {
        label: 'Forms & Waivers Guide',
        url: 'https://help.bondsports.co/en/articles/13066858-managing-forms-questionnaires-in-the-bond-back-office',
        icon: 'Guide',
      },
    ],
    doneWhen: 'Done when at least one form or waiver is created and linked to a product.',
  },
  {
    title: 'Enable Conversion Tracking',
    time: '~5 min',
    description:
      'Connect Bond to tools like Google Analytics (GA4) to track how customers are finding and completing registrations on your site. This is an advanced step — come back to it once your core setup is complete.',
    links: [
      {
        label: 'Conversion Analytics Guide',
        url: 'https://help.bondsports.co/en/collections/12615606-conversion-analytics',
        icon: 'Guide',
      },
    ],
    optional: true,
    doneWhen: 'Done when your GA4 or tracking pixel is connected and firing.',
  },
];
