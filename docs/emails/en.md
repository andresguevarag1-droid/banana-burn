# Trial emails in English (en-US)

English copy of the trial emails (#301), for accounts with `profiles.locale = 'en-US'`. The Spanish copy (the source text) lives in the other files of this folder and does not change. Subject and body are in `src/lib/i18n/en/email.ts`, keyed by the Spanish sentence; `src/lib/email/email-en.test.ts` checks that this document, the dictionary and the emails match.

- Who gets English: the cron (`src/lib/notify-run.ts`) reads `profiles.locale` and `profiles.units` (0070) with `languagesOf`. `en-US` gets English; `es-419`, no value, or a failed read gets Spanish, so an email never stops going out.
- Weights: stored in kg. With `units = 'imperial'` (or no units and English), the day-8 total is shown in lb, rounded to 2.5 lb.
- Prices stay in USD, tax included, with the same numbers as `src/lib/plans.ts`. Plan names: Training (Entreno) and Training + Nutrition (Entreno + Nutrición).
- Voice: direct, with "you". No emojis, no mention of AI. Coach Banana signs every email.
- Routes, one-tap login links (`withLoginLinks`), timing and audience are the same as in Spanish (see secuencia-prueba.md, recuperacion.md, segundo-entreno.md, meta-semanal.md and activacion.md).

## Footer (every email)

Links: Open the app / My progress / Help. With an unsubscribe link: Stop getting these emails / Notification settings. Last line: Banana Burn, your personal trainer on your phone. Atlas Resources SRL.

Why you get it:

- Trial days 2, 4 and 6: You're getting this email because you're on your 7-day trial and have Banana Burn reminders turned on.
- Recovery days 8 and 10: You're getting this email because your 7-day trial ended without a plan and you have Banana Burn reminders turned on.
- Second workout: You're getting this email because you finished your first workout on Banana Burn and have reminders turned on.
- Weekly goal: You're getting this email because you train with Banana Burn and have reminders turned on.
- Activation: You're getting this email because you created a Banana Burn account and have reminders turned on.

## Trial day 2

**Subject:** Your first result starts with logging

**Preview:** See what you've saved and open today's workout.

**Body:**

Your first result can be a logged session, not a change on the scale. If you already trained, check what you saved in Progress: that's your starting point to compare against later.

If you haven't started yet, today you can take that first step. Open your routine, follow the form for each exercise and log the weight and reps you do.

Check what's on for today and keep the rest days in your plan. You don't need to prove anything in two days. You need a start you can repeat.

Coach Banana

**Button:** See my workout

**Route:** `/app/entrenar`

## Trial day 4

**Subject:** More than finishing today's workout

**Preview:** Progress, food and running: choose what you want to keep up.

**Body:**

Keeping going lets you compare your strength, weight, measurements and photos in Progress. Not all progress shows up on the scale.

With Training + Nutrition you can also log your meals and check your calories and macros. Nutrition is included during your trial. After that, it depends on the plan you choose.

Do you run too? Banana Run tracks your runs with GPS. For a guided running plan, check out the Running Season. Seasons are bought separately, and each paid year of a yearly plan includes one free sports season.

Look at what you want to keep in your routine and which plan includes it.

Coach Banana

**Button:** See what my plan includes

**Route:** `/app/incluye`

## Trial day 6

**Subject:** Choose how you want to keep going

**Preview:** Compare the yearly savings and the monthly options in My plan.

**Body:**

See which option fits you.

Yearly: Training costs $59.99 a year, so you save $59.89 compared with 12 monthly payments. Training + Nutrition costs $89.99 a year, so you save $89.89. Each paid year includes one free sports season.

Monthly: Training costs $9.99 a month and Training + Nutrition costs $14.99 a month. Nutrition is only included in Training + Nutrition.

These are regular prices in USD, tax included. The yearly savings compare 12 months at the regular price, without promotions.

In My plan you can review your choice and the terms for your account before you confirm any change.

Coach Banana

**Button:** Review my plan

**Route:** `/app/suscripcion?desde=dia6`

## Recovery day 8

**Subject:** Your progress is waiting

**Preview:** Your trial ended. Choose your plan and pick up where you left off.

**Body:**

_First paragraph, with the account's numbers (see below)._

To keep going, choose your plan in My plan. Yearly comes first: Training costs $59.99 a year and Training + Nutrition costs $89.99 a year. Each paid year includes one free sports season. If you'd rather pay month to month, Training costs $9.99 and Training + Nutrition costs $14.99.

Prices in USD, tax included. Check the plan and the total before you confirm the payment.

Coach Banana

**Button:** Choose my plan

**Route:** `/app/suscripcion`

### Recovery day 8: first paragraph

With saved workouts (sets and weight only when above zero):

During your trial you saved 2 workouts, with 3 sets and 2,732.5 lb lifted. All of it is still in your account.

Without workouts, or if they could not be read:

Your plan for 4 days a week is still ready in your account, with routines built from your details.

## Recovery day 10

**Subject:** Last email about your trial

**Preview:** Your account is still here whenever you want to come back.

**Body:**

This is the last email we'll send you about your trial.

Your account is still open, with everything you saved. When you want to keep going, choose your plan in My plan. Yearly comes first, and you can also pay month to month. Prices in USD, tax included.

Coach Banana

**Button:** Choose my plan

**Route:** `/app/suscripcion`

## Second workout

**Subject:** Your second workout is ready

**Preview:** You did the first one. The second one works the same way, step by step.

**Body:**

A few days ago you finished your first workout. The second one is already in your plan, adjusted to what you logged that time.

Open it when you have a few minutes today. Coach Banana tells you each exercise, how many reps and when to rest.

Your plan works when you train several times a week. The second workout is what gets it going.

Coach Banana

**Button:** Start my second workout

**Route:** `/app/entreno`

## Weekly goal

_Example with 1 of 3 workouts done and a 20-minute session today. Without the minutes, the preview stops after "workouts." and the second paragraph starts with "Coach Banana"._

**Subject:** You can still hit your weekly goal

**Preview:** You've done 1 of 3 workouts. Today's workout takes 20 minutes.

**Body:**

This week you've done 1 of 3 workouts. There are still enough days left to hit your goal.

Today's workout takes 20 minutes. Coach Banana tells you each exercise, how many reps and when to rest.

If you can't today, that's fine. Rest is part of the plan too.

Coach Banana

**Button:** Start today's workout

**Route:** `/app/entreno`

## Activation A0

**Subject:** Your first workout: 12 minutes at home

**Preview:** You can do it now, without going to the gym.

**Body:**

Your first workout takes 12 minutes and you can do it at home right now.

Open the session, follow the cues for each exercise and go at your own pace. You don't have to figure out the whole week today. Start with this workout.

When you finish, save the session so your first step is logged.

Coach Banana

**Button:** Start my workout

**Route:** `/app/entreno?casa=1` for accounts that picked gym or mixed (the at-home first workout); `/app/entreno` otherwise

## Activation A1

**Subject:** Starting is the hard part

**Preview:** Today, start with a 12-minute workout.

**Body:**

Sometimes starting is harder than finding the time.

Today you don't need to go to the gym or set aside an hour. Your first workout is 12 minutes at home, with the cues for each exercise on your phone.

Go at your own pace. When you finish, save your session and you'll have a starting point.

Coach Banana

**Button:** Start my workout

**Route:** `/app/entreno?casa=1` for accounts that picked gym or mixed (the at-home first workout); `/app/entreno` otherwise

## Activation A2

**Subject:** You can still start today

**Preview:** Your first workout is still a small step: 12 minutes.

**Body:**

If you haven't found the time yet, today you can start at home with 12 minutes.

The session shows you what to do in each exercise. Follow the cues, go at your own pace and save the workout when you finish.

You don't need to make up for the days that went by. Start with today.

Coach Banana

**Button:** Start my workout

**Route:** `/app/entreno?casa=1` for accounts that picked gym or mixed (the at-home first workout); `/app/entreno` otherwise
