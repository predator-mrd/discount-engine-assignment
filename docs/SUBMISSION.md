# Before submitting

The code and sample files are ready to push. The following account-specific steps still need to happen; this repository does not claim that a deployment or recording already exists.

## Push to your fork

The assignment asks for a fork of [Opptra's starter](https://github.com/opptra/discount-engine-assignment). Create that fork in your GitHub account first. This local checkout retains the starter's history.

From this project folder, replace `YOUR_USERNAME` with your account name:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/discount-engine-assignment.git
git add .
git commit -m "Add cart offers, reviewed AI rules and PDF cart uploads"
git push -u origin main
```

Do not submit the original Opptra repository URL. Submit your own accessible fork. The repository has no API keys, installed dependencies, or built output in its tracked files; `.gitignore` excludes local files.

## Deploy

Import your fork into Vercel or Netlify. Both configuration files are included. Use Node 24, build with `npm run build`, and publish `dist`. No environment variable is required to load the app, calculate prices, or parse PDFs. The Groq key is entered in the interface by the person testing the AI feature.

For a quick manual deployment, run `npm run build` and upload the resulting `dist` folder to a static host. Use HTTP/HTTPS rather than opening `index.html` directly; the PDF worker needs a served URL.

After deployment:

- Replace the **Live demo** line at the top of `README.md` with the real URL.
- Open that URL and load the sample. Verify the final total is ₹5,339.
- Enter a valid Groq key and try the three example descriptions. Confirm one rule and discard another.
- Upload `sample-data/cart.pdf`, then try `cart-malformed.pdf` and check that the previous cart stays intact.
- Commit and push the README link.

## Record the walkthrough

Record on the live URL, as the brief requests. Keep your API key hidden and use the password field when entering it. A short outline:

1. Load the sample and explain why the Amazon offer wins for the cushion cover.
2. Show the stacked bed-sheet offer, the vase with no offer, and the separate ₹593 cart saving.
3. Parse a new offer, review the fields, discard the draft, then parse and confirm it. Show the recalculated checkout.
4. Try “Give a discount for big orders” and show the clarification message.
5. Upload the sample PDF, then the malformed PDF. Explain why an incomplete import is rejected.
6. Show the ₹3,999 and ₹4,000 boundary carts and mention the rounding decision.

Add the recording's actual URL to the README. The supplied PDF mentions a Loom walkthrough even though its final submission table lists only the repository link, so include the recording to cover both instructions.

## Final check

- [ ] Your fork is public or accessible to the reviewer.
- [ ] GitHub Actions passes.
- [ ] README has the real deployment URL and walkthrough URL.
- [ ] The walkthrough uses the live deployment.
- [ ] The real Groq request works with your chosen key/model.
- [ ] No API key appears in a commit, screenshot, or recording.
- [ ] You can explain the decisions in `docs/DECISIONS.md` in your own words.
