// 브라우저 안에서 실행(page.evaluate): 현재 폭에서 사용자 눈에 이상한 곳을 모은다. 외부 변수 참조 금지.
// 반환: [{ type, where, detail, shotTarget }]
export function check() {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const add = (type, where, detail, shotTarget = null) => out.push({ type, where, detail, shotTarget });
    const R = (el) => el.getBoundingClientRect();
    const shown = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const cut = (s) => s.slice(0, 24);
    const px = (n) => `${Math.round(n)}px`;
    const inter = (a, b) => [Math.min(a.right, b.right) - Math.max(a.left, b.left), Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)];
    // 여러 줄 인라인은 외곽 박스가 앞 요소를 덮으므로 줄 박스(getClientRects)끼리 가장 크게 겹친 값을 쓴다
    const lineOverlap = (x, y) => {
        let best = [0, 0];
        for (const a of x.getClientRects()) for (const b of y.getClientRects()) {
            const o = inter(a, b);
            if (o[0] > 0 && o[1] > 0 && o[0] * o[1] > best[0] * best[1]) best = o;
        }
        return best;
    };
    const INLINE = new Set(["BR", "SUP", "SUB", "B", "STRONG", "I", "EM", "SMALL"]);
    const leaf = (el) => [...el.children].every((c) => INLINE.has(c.tagName));
    const cls = (el) => (typeof el.className === "string" ? el.className : el.className?.baseVal || "").trim().split(/\s+/)[0];
    const name = (el) => {
        const chart = el.closest("[id]");
        return `${chart?.id || "?"} ${el.tagName.toLowerCase()}${cls(el) ? "." + cls(el) : ""} "${cut(txt(el))}"`;
    };
    const anchorOf = (el) => el.closest(".chart-wrap, .table-wrap, .img-wrap, article")?.querySelector("[id]")?.id || el.closest("[id]")?.id;
    // x 방향으로 잘라 주는 조상(스크롤 표·overflow hidden)이 있으면 화면 밖 넘침이 아니다
    const clippedByAncestor = (el) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            if (getComputedStyle(p).overflowX !== "visible") return true;
        }
        return false;
    };
    const fixedAncestor = (el) => {
        for (let p = el; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === "fixed") return true;
        return false;
    };

    // 1. 페이지 가로 스크롤
    const sw = document.documentElement.scrollWidth;
    if (sw > vw + 1) add("page-hscroll", "document", `scrollWidth ${sw} > ${vw}`);

    // 2. 화면 밖으로 나간 요소(가장 바깥 것만)
    const offenders = new Set();
    document.querySelectorAll("body *").forEach((el) => {
        if (el.closest(".highcharts-container, .highcharts-tooltip")) return;
        const r = R(el);
        if (!r.width || !r.height || !(r.right > vw + 1 || r.left < -1)) return;
        if (!shown(el) || clippedByAncestor(el) || fixedAncestor(el)) return;
        offenders.add(el);
    });
    offenders.forEach((el) => {
        if (el.parentElement && offenders.has(el.parentElement)) return;
        const r = R(el);
        add("overflow-viewport", name(el), `left ${px(r.left)} right ${px(r.right)} vw ${vw}`, anchorOf(el));
    });

    // 3. 본문 글자: 잘림(overflow hidden 안에서 넘침)·한두 글자 폭으로 꺾인 세로 글자
    document.querySelectorAll(".report-area *, header *, nav *, aside *").forEach((el) => {
        if (el.closest(".highcharts-container") || !leaf(el) || !txt(el) || !shown(el)) return;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize) || 14;
        const r = R(el);
        if (!r.width) return;
        const clips = cs.overflowX !== "visible" || cs.textOverflow === "ellipsis";
        if (clips && el.scrollWidth > el.clientWidth + 1) {
            add("text-clipped", name(el), `scrollWidth ${el.scrollWidth} > ${el.clientWidth}`, anchorOf(el));
        }
        const lh = parseFloat(cs.lineHeight) || fs * 1.4;
        if (txt(el).length >= 4 && r.width < fs * 2.2 && r.height > lh * 3) {
            add("narrow-text", name(el), `width ${px(r.width)} height ${px(r.height)} font ${px(fs)}`, anchorOf(el));
        }
    });

    // 4. 제목 줄(그림/표 제목 ↔ 자료·단위)·각주 줄 안에서 형제끼리 겹침
    document.querySelectorAll(".chart-info, .table-info, .chart-footnote, .table-footnote, .img-info").forEach((row) => {
        const kids = [...row.children].filter((c) => shown(c) && R(c).width);
        for (let i = 0; i < kids.length; i += 1) {
            for (let j = i + 1; j < kids.length; j += 1) {
                const [ow, oh] = lineOverlap(kids[i], kids[j]);
                if (ow > 2 && oh > 2) add("info-overlap", `${anchorOf(row)} "${cut(txt(kids[i]))}" × "${cut(txt(kids[j]))}"`, `${px(ow)}×${px(oh)}`, anchorOf(row));
            }
        }
    });

    // 5. 표: 스크롤 래퍼 없이 부모보다 넓은 표
    document.querySelectorAll(".report-area table").forEach((t) => {
        const box = t.parentElement;
        if (!box || !shown(t)) return;
        if (R(t).width > R(box).width + 1 && !clippedByAncestor(t)) {
            add("table-wider", `${anchorOf(t)} table "${cut(txt(t))}"`, `${px(R(t).width)} > ${px(R(box).width)}`, anchorOf(t));
        }
    });

    // 6. 이미지: 원본보다 크게 늘어나 흐려짐, 또는 부모보다 넓음
    document.querySelectorAll(".report-area img").forEach((img) => {
        if (!shown(img) || !img.naturalWidth) return;
        const r = R(img);
        const box = R(img.parentElement);
        if (r.width > box.width + 1) add("img-wider", `${anchorOf(img)} img ${img.src.split("/").pop()}`, `${px(r.width)} > ${px(box.width)}`, anchorOf(img));
    });

    // 7. 차트: 글자끼리 겹침·차트 밖 잘림·차트가 영역보다 넓음·모바일에서 안 줄어든 글자
    const SKIP = ".highcharts-tooltip, .highcharts-credits, .highcharts-exporting-group, .highcharts-no-data";
    (window.Highcharts?.charts || []).forEach((c) => {
        if (!c || !c.renderTo || !document.body.contains(c.renderTo) || !shown(c.renderTo)) return;
        const id = c.renderTo.id || "?";
        const box = R(c.container);
        const area = c.renderTo.closest(".chart-area") || c.renderTo.parentElement;
        if (box.width > R(area).width + 1) add("chart-wider", id, `${px(box.width)} > ${px(R(area).width)}`, id);
        const texts = [...c.container.querySelectorAll("text, span, div")].filter((el) => {
            if (el.closest(SKIP) || !txt(el) || !shown(el)) return false;
            if (el.tagName === "text") return !el.parentElement.closest("text");
            return leaf(el) && !el.closest("text");
        }).map((el) => ({ el, r: R(el), t: cut(txt(el)) })).filter((o) => o.r.width && o.r.height);
        texts.forEach((o) => {
            const l = box.left - o.r.left;
            const rr = o.r.right - box.right;
            const tt = box.top - o.r.top;
            const bb = o.r.bottom - box.bottom;
            const worst = Math.max(l, rr, tt, bb);
            if (worst > 1) add("chart-text-clipped", `${id} "${o.t}"`, `outside ${px(worst)}`, id);
        });
        for (let i = 0; i < texts.length; i += 1) {
            for (let j = i + 1; j < texts.length; j += 1) {
                const a = texts[i];
                const b = texts[j];
                if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
                const [ow, oh] = lineOverlap(a.el, b.el);
                // 글자 높이의 25% 이상 겹쳐야 사람 눈에 겹쳐 보인다(행간 여백 오검출 방지)
                if (ow > 2 && oh > Math.min(a.r.height, b.r.height) * 0.25) {
                    add("chart-text-overlap", `${id} "${a.t}" × "${b.t}"`, `${px(ow)}×${px(oh)}`, id);
                }
            }
        }
        if (vw <= 480) {
            const big = texts.filter((o) => parseFloat(getComputedStyle(o.el).fontSize) >= 14
                && o.el.closest(".highcharts-axis-labels, .highcharts-legend, .highcharts-axis, .highcharts-data-labels"));
            if (big.length) {
                const max = Math.max(...big.map((o) => parseFloat(getComputedStyle(o.el).fontSize)));
                add("chart-font-large", id, `${big.length} texts ≥14px (max ${max}px) e.g. "${big[0].t}"`, id);
            }
        }
    });
    return out;
}
