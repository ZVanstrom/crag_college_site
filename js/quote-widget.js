/* QuoteWidget — climbing guide trip booking
 *
 * Usage:
 *   new QuoteWidget({
 *     container: '#quote-widget',
 *     camper:   { name: 'Intro to Outdoor Climbing',
 *                 halfDayRate: 150, fullDayRate: 220,
 *                 secondGuideHalfDay: 200, secondGuideFullDay: 300 },
 *     addons:   [
 *       { id: 'photographer', label: 'Photographer (if available)', halfDayPrice: 60, fullDayPrice: 100 },
 *       { id: 'gear-rental',  label: 'Gear rental (harness + belay device)', price: 15, per: 'person' },
 *       { id: 'shoes',        label: 'Climbing shoes', price: 10, per: 'person' },
 *     ],
 *     emailjs:  { publicKey: '...', serviceId: '...', templateId: '...' }
 *   });
 */
const DISCOUNT_CODES = {
    'fivepercentoff':       { rate: 0.05, label: '5% discount (code)' },
    'tenpercentoff':        { rate: 0.10, label: '10% discount (code)' },
    'fifteenpercentoff':    { rate: 0.15, label: '15% discount (code)' },
    'twentypercentoff':     { rate: 0.20, label: '20% discount (code)' },
    'twentyfivepercentoff': { rate: 0.25, label: '25% discount (code)' },
    'thirtypercentoff':     { rate: 0.30, label: '30% discount (code)' },
};

class QuoteWidget {
    constructor(config) {
        this.config = config;
        this.state = {
            tripDate:    null,
            tripType:    'half',  // 'half' | 'full'
            climbers:    1,
            addons:      {},
            contactPref: { phone: false, text: false, email: false },
            codeDiscount: null,
        };
        if (this.config.addons) {
            this.config.addons.forEach(a => { this.state.addons[a.id] = false; });
        }
        this.container = document.querySelector(config.container);
        if (!this.container) { console.error('QuoteWidget: container not found:', config.container); return; }
        this.render();
        this.$ = (sel) => this.container.querySelector(sel);
        this.bindEvents();
        this.initFlatpickr();
        this.initEmailJS();
        this.update();
    }

    render() {
        const addonsHtml = this.config.addons?.length ? `
                    <div class="qw-field">
                        <label class="qw-label">Add-ons <span style="font-weight:400;color:#94a3b8;font-size:0.85em;">(optional)</span></label>
                        <div class="qw-addons">
                            ${this.config.addons.map(a => {
                                let priceLabel;
                                if (a.halfDayPrice !== undefined) {
                                    priceLabel = `+$${a.halfDayPrice} half / $${a.fullDayPrice} full day`;
                                } else if (a.per === 'person') {
                                    priceLabel = `+$${a.price}/person`;
                                } else {
                                    priceLabel = `+$${a.price}/trip`;
                                }
                                return `<button type="button" class="qw-addon-btn" data-addon="${a.id}">${a.label} <small style="opacity:0.7">${priceLabel}</small></button>`;
                            }).join('')}
                        </div>
                    </div>` : '';

        this.container.innerHTML = `
            <div class="qw">
                <div class="qw-header">
                    <h2>Quote Your Trip</h2>
                    <p>${this.config.camper.name}</p>
                </div>
                <div class="qw-form">
                    <div class="qw-field">
                        <label class="qw-label">Trip Date</label>
                        <input type="text" class="qw-input qw-dates" placeholder="Select a date" readonly>
                    </div>
                    <div class="qw-field">
                        <label class="qw-label">Duration</label>
                        <div class="qw-toggle">
                            <button type="button" class="qw-toggle-btn active" data-type="half">Half Day <small style="opacity:0.7">(5 hrs)</small></button>
                            <button type="button" class="qw-toggle-btn" data-type="full">Full Day <small style="opacity:0.7">(8–9 hrs)</small></button>
                        </div>
                    </div>
                    <div class="qw-field">
                        <label class="qw-label">Number of Climbers</label>
                        <div class="qw-climber-row">
                            <button type="button" class="qw-climber-btn qw-climber-dec" aria-label="Decrease">−</button>
                            <span class="qw-climber-count">1</span>
                            <button type="button" class="qw-climber-btn qw-climber-inc" aria-label="Increase">+</button>
                        </div>
                        <div class="qw-helper qw-group-note">1 guide included for groups of 1–6</div>
                    </div>
                    ${addonsHtml}
                </div>
                <div class="qw-quote">
                    <div class="qw-line-items"></div>
                    <p class="qw-prompt">Select a date to see a quote.</p>
                </div>
                <div class="qw-code-bar" hidden>
                    <div class="qw-code-row">
                        <input type="text" class="qw-input qw-code-input" placeholder="Discount code" autocomplete="off" spellcheck="false">
                        <button type="button" class="qw-code-btn">Apply</button>
                    </div>
                    <p class="qw-code-status"></p>
                </div>
                <div class="qw-customer" hidden>
                    <h3>Save your quote and get in touch!</h3>
                    <p class="qw-customer-sub">Drop your email and we'll send the full breakdown and follow up to lock in your date.</p>
                    <div class="qw-customer-fields">
                        <input type="email" class="qw-input qw-email" placeholder="Email (required)" required>
                        <input type="text"  class="qw-input qw-name"  placeholder="Name (optional)">
                        <input type="tel"   class="qw-input qw-phone" placeholder="Phone (optional)">
                    </div>
                    <div class="qw-field qw-pref-field">
                        <label class="qw-label">Preferred contact method <span style="font-weight:400;color:#94a3b8;font-size:0.85em;">(optional)</span></label>
                        <div class="qw-addons">
                            <button type="button" class="qw-addon-btn qw-pref-btn" data-pref="phone">📞 Phone</button>
                            <button type="button" class="qw-addon-btn qw-pref-btn" data-pref="text">💬 Text</button>
                            <button type="button" class="qw-addon-btn qw-pref-btn" data-pref="email">📧 Email</button>
                        </div>
                    </div>
                    <button type="button" class="qw-send-btn">Send Me This Quote →</button>
                    <p class="qw-status"></p>
                </div>
            </div>
        `;
    }

    bindEvents() {
        this.container.querySelectorAll('.qw-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.container.querySelectorAll('.qw-toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.state.tripType = btn.dataset.type;
                this.update();
            });
        });

        this.$('.qw-climber-dec').addEventListener('click', () => {
            if (this.state.climbers > 1) { this.state.climbers--; this.syncClimberDisplay(); this.update(); }
        });
        this.$('.qw-climber-inc').addEventListener('click', () => {
            if (this.state.climbers < 13) { this.state.climbers++; this.syncClimberDisplay(); this.update(); }
        });

        this.container.querySelectorAll('.qw-addon-btn:not(.qw-pref-btn)').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.addon;
                this.state.addons[id] = !this.state.addons[id];
                btn.classList.toggle('active', this.state.addons[id]);
                this.update();
            });
        });

        const applyCode = () => {
            const input = this.$('.qw-code-input');
            const status = this.$('.qw-code-status');
            const code = input.value.trim().toLowerCase().replace(/\s+/g, '');
            if (!code) { this.state.codeDiscount = null; status.textContent = ''; status.className = 'qw-code-status'; this.update(); return; }
            const match = DISCOUNT_CODES[code];
            if (match) {
                this.state.codeDiscount = match;
                status.textContent = `✓ ${match.label.replace(' (code)', '')} applied`;
                status.className = 'qw-code-status success';
            } else {
                this.state.codeDiscount = null;
                status.textContent = 'Invalid code.';
                status.className = 'qw-code-status error';
            }
            this.update();
        };
        this.$('.qw-code-btn').addEventListener('click', applyCode);
        this.$('.qw-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') applyCode(); });

        this.container.querySelectorAll('.qw-pref-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const pref = btn.dataset.pref;
                this.state.contactPref[pref] = !this.state.contactPref[pref];
                btn.classList.toggle('active', this.state.contactPref[pref]);
            });
        });

        this.$('.qw-send-btn').addEventListener('click', () => this.sendEmail());
    }

    syncClimberDisplay() {
        const c = this.state.climbers;
        this.$('.qw-climber-count').textContent = c > 12 ? '12+' : c;
        this.$('.qw-climber-dec').disabled = c <= 1;
        this.$('.qw-climber-inc').disabled = c >= 13;
    }

    initFlatpickr() {
        if (typeof flatpickr === 'undefined') { console.error('QuoteWidget: flatpickr not loaded'); return; }
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        flatpickr(this.$('.qw-dates'), {
            mode: 'single',
            minDate: 'today',
            defaultDate: tomorrow,
            dateFormat: 'M j, Y',
            onChange: (dates) => {
                this.state.tripDate = dates[0] || null;
                this.update();
            }
        });
        this.state.tripDate = tomorrow;
    }

    initEmailJS() {
        if (window.emailjs && this.config.emailjs?.publicKey) {
            emailjs.init({ publicKey: this.config.emailjs.publicKey });
        }
    }

    computeBasePrice() {
        const isHalf = this.state.tripType === 'half';
        const base       = isHalf ? this.config.camper.halfDayBase       : this.config.camper.fullDayBase;
        const additional = isHalf ? this.config.camper.halfDayAdditional : this.config.camper.fullDayAdditional;
        const extraCount = Math.max(0, this.state.climbers - 1);
        const extraCost  = extraCount * additional;
        return { base, additional, extraCount, extraCost, total: base + extraCost };
    }

    getSecondGuideRate() {
        return this.state.tripType === 'half'
            ? this.config.camper.secondGuideHalfDay
            : this.config.camper.secondGuideFullDay;
    }

    computeAddonLines() {
        const lines = [];
        if (!this.config.addons) return lines;
        for (const a of this.config.addons) {
            if (!this.state.addons[a.id]) continue;
            let cost, detail;
            if (a.halfDayPrice !== undefined) {
                cost = this.state.tripType === 'half' ? a.halfDayPrice : a.fullDayPrice;
                detail = null;
            } else if (a.per === 'person') {
                cost = a.price * this.state.climbers;
                detail = `${this.state.climbers} × $${a.price}`;
            } else {
                cost = a.price;
                detail = null;
            }
            lines.push({ ...a, cost, detail });
        }
        return lines;
    }

    computeTotals() {
        if (!this.state.tripDate) return null;
        const { climbers, tripType } = this.state;
        if (climbers > 12) return { largeGroup: true };

        const pricing = this.computeBasePrice();
        const needsSecondGuide = climbers > 6;
        const secondGuideFee = needsSecondGuide ? this.getSecondGuideRate() : 0;
        const addonLines = this.computeAddonLines();
        const addonsSubtotal = addonLines.reduce((sum, a) => sum + a.cost, 0);
        const preDiscountSubtotal = pricing.total + secondGuideFee + addonsSubtotal;

        let discountRate = 0, discountLabel = null, discountAmount = 0;
        if (this.state.codeDiscount) {
            discountRate = this.state.codeDiscount.rate;
            discountLabel = this.state.codeDiscount.label;
            discountAmount = Math.round(preDiscountSubtotal * discountRate);
        }

        const subtotal = Math.round(preDiscountSubtotal - discountAmount);
        const tax = Math.round(subtotal * 0.06);
        const total = Math.round(subtotal + tax);

        return {
            climbers, tripType, pricing,
            needsSecondGuide, secondGuideFee,
            addonLines, addonsSubtotal,
            preDiscountSubtotal, discountRate, discountLabel, discountAmount,
            subtotal, tax, total,
        };
    }

    update() {
        const lineItems  = this.$('.qw-line-items');
        const prompt     = this.$('.qw-prompt');
        const customer   = this.$('.qw-customer');
        const codeBar    = this.$('.qw-code-bar');
        const groupNote  = this.$('.qw-group-note');

        const c = this.state.climbers;
        if (c <= 6) {
            groupNote.textContent = '1 guide included for groups of 1–6';
            groupNote.className = 'qw-helper qw-group-note';
        } else if (c <= 12) {
            groupNote.textContent = '7–12 climbers: second guide fee applies';
            groupNote.className = 'qw-helper qw-group-note qw-group-warn';
        } else {
            groupNote.innerHTML = 'Groups larger than 12: <a href="mailto:cragcollege@gmail.com" style="color:var(--accent);font-weight:600;">contact us</a> for a custom quote';
            groupNote.className = 'qw-helper qw-group-note qw-group-warn';
        }

        if (!this.state.tripDate) {
            lineItems.innerHTML = ''; prompt.textContent = 'Select a date to see a quote.'; prompt.style.display = ''; customer.hidden = true; codeBar.hidden = true; return;
        }

        const totals = this.computeTotals();

        if (totals?.largeGroup) {
            lineItems.innerHTML = '';
            prompt.innerHTML = 'Groups larger than 12 require a custom quote. <a href="mailto:cragcollege@gmail.com" style="color:var(--accent);font-weight:600;">Email us</a> and we\'ll work something out!';
            prompt.style.display = '';
            customer.hidden = true; codeBar.hidden = true; return;
        }

        if (!totals) {
            lineItems.innerHTML = ''; prompt.textContent = 'Select a date to see a quote.'; prompt.style.display = ''; customer.hidden = true; codeBar.hidden = true; return;
        }

        prompt.style.display = 'none';
        const tripLabel = totals.tripType === 'half' ? 'Half Day (5 hrs)' : 'Full Day (8–9 hrs)';
        const { pricing } = totals;
        const lines = [];

        lines.push(`<div class="qw-line"><span>${tripLabel} : 1st climber</span><span>$${pricing.base.toLocaleString()}</span></div>`);
        if (pricing.extraCount > 0) {
            lines.push(`<div class="qw-line"><span>+ ${pricing.extraCount} additional climber${pricing.extraCount !== 1 ? 's' : ''} × $${pricing.additional}</span><span>$${pricing.extraCost.toLocaleString()}</span></div>`);
        }
        lines.push(`<div class="qw-line qw-gear-note"><span>All gear included <small>(harness, helmet, rope, draws)</small></span><span class="qw-free">✓</span></div>`);

        if (totals.needsSecondGuide) {
            lines.push(`<div class="qw-line"><span>Second guide fee <small>(7–12 climbers)</small></span><span>$${totals.secondGuideFee.toLocaleString()}</span></div>`);
        }

        for (const a of totals.addonLines) {
            const detail = a.detail ? ` <small>(${a.detail})</small>` : '';
            lines.push(`<div class="qw-line"><span>${a.label}${detail}</span><span>$${a.cost.toLocaleString()}</span></div>`);
        }

        if (totals.discountAmount > 0) {
            lines.push(`<div class="qw-line qw-discount"><span>${totals.discountLabel}</span><span>-$${totals.discountAmount.toLocaleString()}</span></div>`);
        }

        lines.push(`<div class="qw-line qw-subtotal"><span>Subtotal</span><span>$${totals.subtotal.toLocaleString()}</span></div>`);
        lines.push(`<div class="qw-line"><span>Tax <small>(6%)</small></span><span>$${totals.tax.toLocaleString()}</span></div>`);
        lines.push(`<div class="qw-line qw-total"><span>Total</span><span>$${totals.total.toLocaleString()}</span></div>`);

        lineItems.innerHTML = lines.join('');
        customer.hidden = false;
    }

    async sendEmail() {
        const status = this.$('.qw-status');
        const email  = this.$('.qw-email').value.trim();
        if (!email) { status.textContent = 'Email is required.'; status.className = 'qw-status qw-error'; return; }
        const totals = this.computeTotals();
        if (!totals || totals.largeGroup) return;

        const fmt = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        const tripLabel = this.state.tripType === 'half' ? 'Half Day (5 hrs)' : 'Full Day (8–9 hrs)';
        const addonLines = totals.addonLines;
        const addonsLabel = addonLines.length
            ? 'Add-ons: ' + addonLines.map(a => {
                const detail = a.detail ? ` (${a.detail})` : '';
                return `${a.label}${detail}`;
              }).join(', ')
            : 'Add-ons';
        const addonsSubtotal = addonLines.length ? `$${totals.addonsSubtotal.toLocaleString()}` : 'None';

        const params = {
            subject:            `Quote Request - ${this.config.camper.name} - ${fmt(this.state.tripDate)}`,
            camper:             this.config.camper.name,
            customer_email:     email,
            customer_name:      this.$('.qw-name').value.trim(),
            customer_phone:     this.$('.qw-phone').value.trim(),
            contact_preference: Object.entries(this.state.contactPref).filter(([,v]) => v).map(([k]) => k.charAt(0).toUpperCase() + k.slice(1)).join(', ') || 'Not specified',
            discount_code:      this.state.codeDiscount ? `${this.$('.qw-code-input').value.trim()} (${Math.round(this.state.codeDiscount.rate * 100)}% off)` : 'None',
            name:               this.$('.qw-name').value.trim(),
            email:              email,
            check_in:           fmt(this.state.tripDate),
            check_out:          fmt(this.state.tripDate),
            total_nights:       `${tripLabel} · ${totals.climbers} climber${totals.climbers !== 1 ? 's' : ''}`,
            nights_subtotal:    totals.pricing.extraCount > 0
                ? `$${totals.pricing.base} + ${totals.pricing.extraCount} additional × $${totals.pricing.additional} = $${totals.pricing.total}`
                : `$${totals.pricing.base} (1 climber)`,
            delivery_mode:      totals.needsSecondGuide ? 'Second guide (7–12 climbers)' : 'Single guide (1–6 climbers)',
            delivery_subtotal:  totals.needsSecondGuide ? `$${totals.secondGuideFee.toLocaleString()}` : 'Included',
            tow_insurance_subtotal: 'N/A',
            addons_label:       addonsLabel,
            addons_subtotal:    addonsSubtotal,
            discount_label:     totals.discountAmount > 0 ? totals.discountLabel : 'No discount',
            discount_amount:    totals.discountAmount > 0 ? `-$${totals.discountAmount.toLocaleString()}` : '—',
            subtotal:           `$${totals.subtotal.toLocaleString()}`,
            tax:                `$${totals.tax.toLocaleString()}`,
            total:              `$${Math.round(totals.total).toLocaleString()}`,
        };

        status.textContent = 'Sending…';
        status.className = 'qw-status';
        try {
            await emailjs.send(this.config.emailjs.serviceId, this.config.emailjs.templateId, params);
            status.textContent = "✓ Quote sent! Check your inbox. We'll be in touch shortly.";
            status.className = 'qw-status qw-success';
            history.replaceState(null, '', '#booking-complete');
            gtag('event', 'conversion', { 'send_to': 'AW-18144729913/4tFbCOnfyagcELm2isxD' });
        } catch (err) {
            console.error('EmailJS error:', err);
            status.textContent = 'Couldn\'t send. Please email cragcollege@gmail.com directly.';
            status.className = 'qw-status qw-error';
        }
    }
}
