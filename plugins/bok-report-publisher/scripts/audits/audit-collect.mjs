// 브라우저 안에서 실행(page.evaluate): 렌더된 그림·표·각주 위치·장별 텍스트를 수집한다. 외부 변수 참조 금지.
export function collect() {
    const area = document.querySelector(".report-area");
    // 각주 표시는 ⟦id⟧ 로 바꿔 위치를 보존한 텍스트
    const marked = (el) => {
        const c = el.cloneNode(true);
        c.querySelectorAll(".tooltip-btn").forEach((a) => a.replaceWith(`⟦${a.textContent.trim()}⟧`));
        return c.textContent;
    };
    const plainText = (el) => marked(el).replace(/⟦[^⟧]*⟧/g, "");
    const chapterOf = (el) => el.closest(".report-area > div > .report-section, .report-area > * ")?.querySelector("h2")?.id || "";
    const chapter = (el) => {
        let node = el;
        while (node && node.parentElement !== area) node = node.parentElement;
        return node?.querySelector("h2")?.id || chapterOf(el);
    };

    const figures = [...area.querySelectorAll(".chart-wrap, .img-wrap")].map((el) => {
        const spans = el.querySelectorAll(".chart-info > span, .img-info > span");
        return {
            chapter: chapter(el),
            title: spans[0] ? plainText(spans[0]) : "",
            source: spans[1] ? plainText(spans[1]) : "",
            notes: [...el.querySelectorAll(".chart-footnote")].map(plainText).join(" "),
            charts: el.querySelectorAll(".chart-area").length,
            drawn: el.querySelectorAll(".chart-area svg.highcharts-root").length,
            images: [...el.querySelectorAll("img")].map((img) => ({ ok: img.complete && img.naturalWidth > 0, src: img.getAttribute("src") || "" })),
        };
    });

    const tables = [...document.querySelectorAll(".report-area table, [data-toggle-content] table")].map((t) => ({
        chapter: t.closest("[data-toggle-content]") ? "tooltip" : chapter(t),
        caption: plainText(t.closest("article")?.querySelector(".table-info > span") || document.createElement("i")),
        rows: [...t.rows].map((r) => [...r.cells].map((c) => ({ t: plainText(c), cs: c.colSpan, rs: c.rowSpan }))),
    }));

    const markedCorpus = [...area.querySelectorAll(".tooltip-btn")]
        .map((a) => a.closest("p, h3, h4, h5, li, td, th, span, div")).filter(Boolean)
        .filter((el, i, all) => all.indexOf(el) === i).map(marked).join("\u0001");

    const chapters = {};
    [...area.children].forEach((node) => {
        const id = node.querySelector("h2")?.id;
        if (id) chapters[id] = plainText(node);
    });
    const tips = [...document.querySelectorAll("[data-toggle-content]")].map(plainText).join("\u0001");
    return { figures, tables, markedCorpus, chapters, tips };
}
