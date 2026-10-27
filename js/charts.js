// FILEFORGE — Dashboard comparison charts
// Self-contained: draws its own SVG line chart + an interactive bar
// comparison using plain math (N/2 for Heap avg comparisons, floor(log2 N)+1
// for Sequential Binary Search). Does not read any global app state, so it
// works regardless of which simulation module files are wired up.
(function () {
    "use strict";

    var N_POINTS = [10, 50, 100, 200, 400, 700, 1000];
    var PAD = { left: 40, right: 18, top: 16, bottom: 26 };
    var VB_W = 600;
    var VB_H = 240;
    var BAR_MAX_SCALE = 500; // heap comparisons at slider max (N=1000 -> 500)

    function heapComparisons(n) { return n / 2; }
    function seqComparisons(n) { return Math.floor(Math.log2(n)) + 1; }

    function svgEl(tag, attrs) {
        var el = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (var key in attrs) el.setAttribute(key, attrs[key]);
        return el;
    }

    function buildGrowthChart() {
        var svg = document.getElementById("growthChart");
        if (!svg) return;
        svg.innerHTML = "";

        var maxY = heapComparisons(N_POINTS[N_POINTS.length - 1]); // 500
        var plotW = VB_W - PAD.left - PAD.right;
        var plotH = VB_H - PAD.top - PAD.bottom;

        function xAt(i) { return PAD.left + (i / (N_POINTS.length - 1)) * plotW; }
        function yAt(v) { return PAD.top + plotH - (v / maxY) * plotH; }

        // Baseline axis
        svg.appendChild(svgEl("line", {
            x1: PAD.left, y1: PAD.top + plotH, x2: VB_W - PAD.right, y2: PAD.top + plotH,
            class: "chart-axis-line"
        }));

        // X-axis labels
        N_POINTS.forEach(function (n, i) {
            var t = svgEl("text", {
                x: xAt(i), y: VB_H - 8, class: "chart-axis-label", "text-anchor": "middle"
            });
            t.textContent = n;
            svg.appendChild(t);
        });

        function buildPath(values) {
            return values.map(function (v, i) {
                return (i === 0 ? "M" : "L") + xAt(i) + "," + yAt(v);
            }).join(" ");
        }

        var heapValues = N_POINTS.map(heapComparisons);
        var seqValues = N_POINTS.map(seqComparisons);

        var heapPath = svgEl("path", { d: buildPath(heapValues), class: "chart-line heap-line" });
        var seqPath = svgEl("path", { d: buildPath(seqValues), class: "chart-line seq-line" });
        svg.appendChild(heapPath);
        svg.appendChild(seqPath);

        // Points (with native tooltips)
        [
            { values: heapValues, cls: "heap-point", label: "Heap" },
            { values: seqValues, cls: "seq-point", label: "Sequential" }
        ].forEach(function (series) {
            series.values.forEach(function (v, i) {
                var c = svgEl("circle", {
                    cx: xAt(i), cy: yAt(v), r: 3.5, class: "chart-point " + series.cls
                });
                var title = svgEl("title", {});
                title.textContent = series.label + " @ N=" + N_POINTS[i] + " \u2192 " + Math.round(v) + " comparisons";
                c.appendChild(title);
                svg.appendChild(c);
            });
        });

        // Draw-in animation for both lines
        [heapPath, seqPath].forEach(function (path, idx) {
            var length = path.getTotalLength();
            path.style.strokeDasharray = length;
            path.style.strokeDashoffset = length;
            // force reflow so the transition actually runs
            path.getBoundingClientRect();
            path.style.transition = "stroke-dashoffset 1.1s ease " + (idx * 0.15) + "s";
            requestAnimationFrame(function () {
                path.style.strokeDashoffset = "0";
            });
        });
    }

    function wireSlider() {
        var slider = document.getElementById("chartNSlider");
        var label = document.getElementById("chartNLabel");
        var heapBar = document.getElementById("chartHeapBar");
        var seqBar = document.getElementById("chartSeqBar");
        var heapVal = document.getElementById("chartHeapVal");
        var seqVal = document.getElementById("chartSeqVal");
        if (!slider) return;

        function update() {
            var n = parseInt(slider.value, 10);
            var heap = Math.round(heapComparisons(n));
            var seq = seqComparisons(n);

            label.textContent = n;
            heapVal.textContent = heap;
            seqVal.textContent = seq;

            heapBar.style.width = Math.min(100, (heap / BAR_MAX_SCALE) * 100) + "%";
            seqBar.style.width = Math.min(100, (seq / BAR_MAX_SCALE) * 100) + "%";
        }

        slider.addEventListener("input", update);
        update();
    }

    document.addEventListener("DOMContentLoaded", function () {
        buildGrowthChart();
        wireSlider();

        // Re-run the draw-in animation whenever the user navigates back to the Dashboard
        document.querySelectorAll('.nav-btn[data-page="dashboard"]').forEach(function (btn) {
            btn.addEventListener("click", function () {
                setTimeout(buildGrowthChart, 60);
            });
        });
    });
})();
