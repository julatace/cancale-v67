# Chrome Web Store listing — English (ready to paste)

> Translation of the French listing (`docs/boutiques/chrome-web-store.md`, the audited source:
> when one changes, change the other). Usable as a second listing language only once the package
> carries `_locales/en` (5.409.0 still has none: the Store then offers a single listing language,
> French — keep this text for the reviewers' notes and for later). Updated 20 Nov. 2026 for **5.409.0**.
> Screenshots: `node scripts/boutiques-visuels.cjs --langue en --sortie <folder>` produces
> `en-capture-1…5` and `en-tuile-440x280.png` (see `README.md`).

## Store listing

**Summary** (from the package — `_locales/en/messages.json` once it exists; 123 characters):
Connect your Vinted, Leboncoin, eBay and Vestiaire accounts to VRM: listings, sales, parcels and labels, from your browser.

**Description**:

```
VRM is the management tool for second-hand resellers (https://vrm.center). This extension links the VRM app to your own Vinted, Leboncoin, eBay and Vestiaire Collective accounts, from your browser: nothing left to copy by hand.

Who it is for: second-hand sellers who run one or several accounts on these sites and want their sales, parcels and figures in one place.

What it does for you
• It stores in your VRM space what these sites already show about your own activity when you open them: listings, sales, purchases, messages, offers, balances, shipping labels.
• It fetches the shipping labels of your sales, ready to print with the storage number of the item.
• It reads the pick-up codes of your parcels and their status at the carrier.
• On your click in VRM: fill in or publish a listing on Leboncoin, eBay or Vestiaire Collective, relist a Vinted item, lower or restore a price, hide or show a listing, turn holiday mode on, create a Vinted draft, answer a message, accept, decline or make an offer, generate a shipping label.
• Only if you switch them on in VRM (off by default): accept Vinted offers above the minimum price you set (and decline with YOUR message those below your threshold), answer offers step by step without ever going below your floor, lower a price by YOUR rule after a few days without a sale, hide on Vinted a listing whose sale is proven on another site, and send your message to people who add your item to their favourites.
• While it acts for you on the site, a screen says so, with “Stop everything”.

Its safeguards
• It only acts for the account signed in on the tab, never another one.
• At most 50 actions per hour and 200 per day per account (default setting), one request at a time; it stops at once when the site asks for a pause or a check.
• It never reads the password of your reselling accounts nor your browsing history.
• What it reads goes only to YOUR VRM account. Nothing is sold, nothing is used for advertising.

A VRM account is required (vrm.center). What the extension reads and sends: https://vrm.center/legal/extension.html

VRM is an independent tool, not affiliated with or endorsed by Vinted, Leboncoin, eBay or Vestiaire Collective.
```

**Category**: Productivity → Tools. **Language**: English.

## Privacy practices (the form is answered once, in any language; English versions)

**Single purpose**:
```
Link the user's own reselling accounts (Vinted, Leboncoin, eBay, Vestiaire Collective) to their VRM space: store in VRM the selling activity read on these sites, and carry out on these accounts the selling actions the user orders from VRM.
```

| permission | justification |
|---|---|
| `cookies` | Read Vinted's session cookies (access_token_web, refresh_token_web, anon_id) to know which Vinted account is signed in and act only for that one; these tokens are stored in the user's VRM space to carry out the actions the user orders. |
| `storage` | Keep the extension's state between service-worker wake-ups: VRM session, counters for the 50-actions-per-hour cap, pending commands, task dates. |
| `alarms` | Restart periodic tasks: account refresh (every 10 to 20 minutes), pending photos (every minute), VRM session renewal (40 minutes). |
| `scripting` | Run, in the Vinted, Leboncoin or Vestiaire Collective tab the user already opened, the reads and actions the user orders, from the page itself (same origin, same cookies). Only functions from the package are injected. |
| `tabs` | Find the site or VRM tab already open, open the useful page (VRM, listing form) when the user asks, and tell VRM which reselling sites are open in this browser (without their address); tab URLs are neither kept nor sent. |
| `downloads` | Recognise the PDF of a shipping label the user downloads from Vinted, to store it with the sale; every other download is ignored and the extension starts none. |
| `contextMenus` | Add two entries to the right-click menu of the extension icon, "Connexion à VRM" and "État de l'extension", which open the extension's sign-in page in a tab. No other menu, no page reading. |

**Host permissions** (one box):
```
Each site is one of the user's accounts or a VRM service; no all-sites permission.
- vinted.fr / .com / .it / .de: the user's Vinted accounts (read their activity, carry out their actions).
- vinted.net: the photos of their Vinted listings (Vinted's image server), to attach them to the same listing on another site.
- amazonaws.com: Vinted serves its shipping-label PDFs from Amazon S3 storage (svc-shipping-labels.s3.eu-central-1.amazonaws.com); the extension downloads them to store them with the sale.
- leboncoin.fr: the user's Leboncoin accounts.
- ebay.fr, ebay.com: the user's eBay accounts (fill in a listing from VRM).
- vestiairecollective.com: the user's Vestiaire Collective accounts (read their activity, publish or re-read the listing they post from VRM).
- i.ebayimg.com: the public photos of THEIR eBay listings — only a fingerprint of a photo (never the image, no cookie), to recognise the same photo as a Vinted listing.
- mondialrelay.fr, mondialrelay.be, ws.chronopost.fr, carrier.vintedgo.com: read the public status of parcels the user is waiting for (tracking number), at most 12 reads per hour per carrier.
- chronopost.fr/tracking-no-cms, vintedgo.com (content scripts): on a tracking page the user opened, read only the page address (the tracking number), never its content.
- lgonxzrzjcqthjtbdpzo.supabase.co: VRM's database, where the user's space is stored.
- vrm.center: the VRM app, which commands the extension, and the latest version number (read at most every 6 hours).
```

**Remote code**: "No, I am not using remote code".

**Data usage** — checked: personally identifiable information · financial and payment information · authentication information · personal communications · user activity · website content. Not checked: health · location · web history. The three certifications: all checked.

**Privacy policy URL**: https://vrm.center/legal/extension.html
