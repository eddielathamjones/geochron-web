# geochron-web — Next Steps

## What this repo is

A proof-of-concept experiment combining map tile vibes with a real-time solar
daylight overlay (terminator line, night polygon, subsolar point).
It proved out the solar geometry and confirmed the visual approach before
absorbing it into the pedestrian-safety-mapper flagship project.

## Portfolio reframing (Phase 2)

- [ ] Relabel as "Experiment: Solar Daylight Overlay" in README and GitHub description
- [ ] Rewrite README to lead with the "experiment" narrative:
      - What question was being explored?
      - What was learned?
      - What did it become in the safety mapper?
- [ ] Add Ko-fi tip button
- [ ] Add GitHub Sponsors link
- [ ] Deploy self-hosted at `solar.eddielathamjones.com` (always-on, no cold starts)
- [ ] Write Ghost portfolio post telling the experiment → flagship story

## What gets absorbed into safety mapper

The **solar geometry module** is extracted and reused directly — no rewrite needed.

Steps:
1. Extract the solar geometry calculations (terminator, night polygon, subsolar point)
   from the backend into a standalone module
2. Add a `/api/solar` endpoint to the safety mapper backend
3. Render the night polygon as a MapLibre GeoJSON layer in the safety mapper frontend

## Why it becomes more powerful in the safety mapper

In this repo the solar overlay is a standalone visual effect.
In the safety mapper it becomes analytically meaningful — the night polygon
directly contextualises lighting condition data. Darkness isn't just aesthetic,
it explains the pattern of fatalities. That's a significant upgrade in purpose.
