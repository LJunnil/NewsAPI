/**
 * ============================================================
 * CENTRALIZED SAUNA NEWS DATA PROVIDER
 * ============================================================
 *
 * get_sauna_news_data()
 *
 * Single source of truth for ALL news components.
 * - Fetches from SerpAPI ONCE per day
 * - Caches result in WordPress Transients
 * - Sorts ALL articles globally by newest date FIRST
 * - All shortcodes call this function instead of the API
 *
 * Cache key:      sauna_news_master_cache
 * Cache duration: DAY_IN_SECONDS (86400 seconds)
 * ============================================================
 */
function get_sauna_news_data() {

    // ── 1. Return cached data immediately if available ────────────────────────
    $cached = get_transient( 'sauna_news_master_cache' );
    if ( $cached !== false ) {
        return $cached;
    }

    // ── 2. Cache miss — fetch from SerpAPI ────────────────────────────────────
    $api_key = 'c80b2bf860a3000ba7a13fb9176a533fa342f8fe24f3810dc4fe3e986cfbf4d6';

    $url = add_query_arg( array(
        'engine'  => 'google_news',
        'q'       => 'sauna "sauna" when:1d',
        'hl'      => 'en',
        'api_key' => $api_key,
    ), 'https://serpapi.com/search.json' );

    $response = wp_remote_get( $url, array( 'timeout' => 20 ) );

    // ── 3. Error handling: return empty array safely, never break the page ────
    if ( is_wp_error( $response ) ) {
        return array();
    }

    $body = wp_remote_retrieve_body( $response );
    $data = json_decode( $body );

    if ( empty( $data->news_results ) ) {
        return array();
    }

    $articles = $data->news_results;

    // ── 4. Sort ALL articles globally by newest date FIRST ───────────────────
    //
    // CRITICAL: Sorting happens HERE, before any slicing into Featured /
    // Recent / More sections. This guarantees every section always shows
    // the correct chronological order and fixes the bug where "Recent News"
    // was showing older articles than "More News".
    //
    // Date parsing: strip the "+0000 UTC" suffix SerpAPI appends, then
    // run strtotime(). Unparseable dates fall back to timestamp 0 so they
    // sink to the bottom rather than crashing the sort.
    usort( $articles, function ( $a, $b ) {
        $parse = function ( $article ) {
            if ( empty( $article->date ) ) return 0;
            $raw   = trim( $article->date );
            $clean = preg_replace( '/,?\s*\+\d{4}\s*UTC\s*$/i', '', $raw );
            $ts    = strtotime( $clean );
            return $ts ? $ts : 0;
        };
        return $parse( $b ) - $parse( $a ); // newest first
    } );

    // ── 5. Store the fully-sorted array in the transient cache ───────────────
    set_transient( 'sauna_news_master_cache', $articles, DAY_IN_SECONDS );

    return $articles;
}


/**
 * ============================================================
 * HELPER: timestamp parser (shared by both shortcodes)
 * ============================================================
 */
function _sn_get_ts( $article ) {
    if ( empty( $article->date ) ) return 0;
    $raw   = trim( $article->date );
    $clean = preg_replace( '/,?\s*\+\d{4}\s*UTC\s*$/i', '', $raw );
    $ts    = strtotime( $clean );
    return $ts ? $ts : 0;
}

function _sn_format_date( $article ) {
    $ts = _sn_get_ts( $article );
    if ( $ts ) return date( 'M j, Y', $ts );
    if ( ! empty( $article->date ) ) {
        return preg_replace( '/,?\s*\+\d{4}\s*UTC\s*$/i', '', trim( $article->date ) );
    }
    return '';
}


/**
 * ============================================================
 * SHORTCODE: [sauna_news_fetch]
 *
 * Full news page: Featured + Recent (3) + More (rest).
 * Pulls from the shared centralized cache — NO direct API call.
 *
 * Slicing rules (applied to globally-sorted array):
 *   $articles[0]          → Featured  (newest)
 *   array_slice( ..1, 3 ) → Recent    (next 3 newest)
 *   array_slice( ..4 )    → More      (remainder, already sorted)
 * ============================================================
 */
function sauna_news_fetch() {

    // ── Get sorted data from shared cache ─────────────────────────────────────
    $articles = get_sauna_news_data();

    if ( empty( $articles ) ) {
        return '<p>Unable to fetch sauna news at this time.</p>';
    }

    // ── Slice into display sections (data is already sorted) ─────────────────
    $featured = $articles[0];
    $latest   = array_slice( $articles, 1, 3 );  // positions 1-3 = 2nd, 3rd, 4th newest
    $more_raw = array_slice( $articles, 4 );       // position 4+ = remainder

    // ── Helpers (closures wrapping the shared helpers) ────────────────────────
    $format_date = function( $article ) { return _sn_format_date( $article ); };

    // --- Icons ---
    $icon_ph     = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2C12 2 8 6.5 8 10.5C8 12.43 8.74 14.18 10 15.5C10 13 11.5 11.5 11.5 11.5C11.5 14.5 13.5 16.5 13.5 16.5C14.5 15.5 15 14 15 12.5C15 14.5 16 16 16 16C16.63 14.69 17 13.13 17 11.5C17 7 12 2 12 2Z"/></svg>';
    $icon_load   = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="6 13 12 19 18 13"/></svg>';
    $icon_search = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/></svg>';
    $icon_read_more_arrow = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="8" x2="13" y2="8"/><polyline points="9,4 13,8 9,12"/></svg>';

    // --- CSS --- (unchanged from original)
    ob_start(); ?>
<style>
@import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap");
:root {
    --sn-title:     rgb(0,63,46);
    --sn-text:      rgb(31,31,31);
    --sn-bark:      #7a5c3e;
    --sn-sand:      #d4bb9a;
    --sn-rule:      #ddd4c4;
    --sn-faint:     #9c9189;
    --sn-forest:    rgb(0,63,46);
    --sn-forest-dk: #1a4a36;
    --sn-gold:      #C8952A;
    --sn-gold-lt:   #e6b84a;
    --sn-cream:     #fdfaf6;
}

/* ── Reset ── */
.sn-wrap *, .sn-wrap *::before, .sn-wrap *::after { box-sizing: border-box; margin: 0; padding: 0; }
.sn-wrap {
    max-width: 1500px;
    margin: 0 auto;
    padding: 0 48px 80px;
    font-family: "DM Sans", sans-serif;
    background: transparent;
    color: var(--sn-text);
}
.sn-wrap > .sn-featured,
.sn-wrap > .sn-section-head:first-child { margin-top: 48px; }

/* ── Section head ── */
.sn-section-head { display: flex; align-items: center; gap: 14px; margin-bottom: 28px; }
.sn-section-head span { font-size: .62rem; font-weight: 500; letter-spacing: .22em; text-transform: uppercase; color: var(--sn-faint); white-space: nowrap; }
.sn-section-head::after { content: ""; flex: 1; height: 1px; background: var(--sn-rule); }

/* ════════════════════════════════════════
   FEATURED SECTION — Improved
════════════════════════════════════════ */
.sn-featured {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    text-decoration: none;
    color: inherit;
    margin-bottom: 64px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 4px 32px rgba(0, 63, 46, 0.10), 0 1px 4px rgba(0,0,0,0.06);
    border: 1px solid rgba(0, 63, 46, 0.09);
    transition: box-shadow 0.4s ease;
}
.sn-featured:hover {
    box-shadow: 0 8px 48px rgba(0, 63, 46, 0.16), 0 2px 8px rgba(0,0,0,0.08);
}

/* Image pane */
.sn-featured-img {
    position: relative;
    overflow: hidden;
    background: var(--sn-forest);
    aspect-ratio: unset;
    min-height: 420px;
}
.sn-featured-img img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform .75s cubic-bezier(.4,0,.2,1);
    filter: saturate(.78) brightness(.88);
}
.sn-featured:hover .sn-featured-img img { transform: scale(1.05); }

/* Gradient overlay on image */
.sn-featured-img::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
        to right,
        rgba(0, 0, 0, 0.18) 0%,
        transparent 60%
    );
    pointer-events: none;
    z-index: 1;
}

/* Placeholder when no image */
.sn-img-ph {
    position: absolute;
    inset: 0;
    background: linear-gradient(155deg, var(--sn-forest) 0%, var(--sn-forest-dk) 55%, var(--sn-bark) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
}
.sn-img-ph svg { width: 52px; height: 52px; fill: var(--sn-sand); opacity: .2; }

/* Body pane */
.sn-featured-body {
    padding: 44px 48px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: var(--sn-cream);
    position: relative;
}

/* Subtle left border accent */
.sn-featured-body::before {
    content: "";
    position: absolute;
    left: 0; top: 44px; bottom: 44px;
    width: 1px;
    background: linear-gradient(180deg, transparent, var(--sn-gold) 30%, var(--sn-gold) 70%, transparent);
    opacity: 0.35;
}

/* Cover label */
.sn-cover-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: .6rem;
    font-weight: 600;
    letter-spacing: .24em;
    text-transform: uppercase;
    color: var(--sn-gold);
    margin-bottom: 16px;
}
.sn-cover-label::before {
    content: "";
    display: block;
    width: 24px;
    height: 1.5px;
    background: var(--sn-gold);
    border-radius: 2px;
}

/* Featured title */
.sn-featured-title {
    font-family: "Playfair Display", serif;
    font-size: clamp(1.7rem, 2.4vw, 2.6rem);
    font-weight: 700;
    line-height: 1.2;
    color: var(--sn-title);
    margin-bottom: 20px;
    letter-spacing: -.02em;
}

/* Ornamental divider */
.sn-featured-ornament {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 18px;
}
.sn-featured-ornament-line {
    height: 1px;
    width: 32px;
    background: linear-gradient(90deg, var(--sn-gold), transparent);
    border-radius: 2px;
}
.sn-featured-ornament-diamond {
    width: 5px;
    height: 5px;
    background: var(--sn-gold);
    transform: rotate(45deg);
    flex-shrink: 0;
    opacity: 0.5;
}

/* Meta row */
.sn-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: .64rem;
    font-weight: 500;
    color: var(--sn-faint);
    text-transform: uppercase;
    letter-spacing: .09em;
}
.sn-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--sn-sand); flex-shrink: 0; }

/* ── Premium Read More Button ── */
.sn-read-more {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: "DM Sans", sans-serif;
    font-size: .7rem;
    font-weight: 600;
    letter-spacing: .18em;
    text-transform: uppercase;
    color: var(--sn-forest);
    text-decoration: none;
    margin-top: 28px;
    padding-bottom: 4px;
    position: relative;
    transition: color 0.3s ease, gap 0.35s ease;
    width: fit-content;
}
.sn-read-more::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    height: 1.5px;
    width: 100%;
    background: linear-gradient(90deg, var(--sn-forest), var(--sn-gold));
    border-radius: 2px;
    transform-origin: left center;
    transform: scaleX(0.28);
    transition: transform 0.4s cubic-bezier(.4,0,.2,1);
}
.sn-featured:hover .sn-read-more::after,
.sn-read-more:hover::after {
    transform: scaleX(1);
}
.sn-featured:hover .sn-read-more,
.sn-read-more:hover {
    color: var(--sn-gold);
    gap: 13px;
}
.sn-read-more .sn-read-more-arr {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    transition: transform 0.35s cubic-bezier(.4,0,.2,1);
}
.sn-featured:hover .sn-read-more .sn-read-more-arr,
.sn-read-more:hover .sn-read-more-arr {
    transform: translateX(3px);
}
.sn-read-more .sn-read-more-arr svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    fill: none;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    overflow: visible;
    display: block;
}

/* ── Card grid styles ── */
.sn-card { text-decoration: none; color: inherit; display: flex; flex-direction: column; }
.sn-card-img { position: relative; overflow: hidden; background: var(--sn-forest); margin-bottom: 14px; }
.sn-card-img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform .5s ease; filter: saturate(.78); }
.sn-card:hover .sn-card-img img { transform: scale(1.05); }
.sn-card-ph { position: absolute; inset: 0; background: linear-gradient(135deg, var(--sn-forest) 0%, var(--sn-bark) 100%); display: flex; align-items: center; justify-content: center; }
.sn-card-ph svg { width: 28px; height: 28px; fill: var(--sn-sand); opacity: .18; }
.sn-card-source { font-size: .58rem; font-weight: 500; letter-spacing: .15em; text-transform: uppercase; color: var(--sn-bark); margin-bottom: 6px; line-height: 1.4; }
.sn-card-title { font-family: "Playfair Display", serif; font-weight: 600; line-height: 1.35; color: var(--sn-title); flex: 1; margin-bottom: 8px; }
.sn-card:hover .sn-card-title { color: var(--sn-forest-dk); }
.sn-card-date { font-size: .59rem; font-weight: 300; color: var(--sn-faint); border-top: 1px solid var(--sn-rule); margin-top: 2px; }
.sn-grid-latest { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; margin-bottom: 60px; }
.sn-grid-latest .sn-card-img { aspect-ratio: 16/10; }
.sn-grid-latest .sn-card-title { font-size: 1.06rem; }
.sn-grid-more { display: grid; grid-template-columns: repeat(4, 1fr); gap: 26px; }
.sn-grid-more .sn-card-img { aspect-ratio: 3/2; }
.sn-grid-more .sn-card-title { font-size: 1rem; }

/* More head row */
.sn-more-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 28px; }
.sn-search-wrap { position: relative; max-width: 360px; flex-shrink: 0; }
.sn-search-wrap svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; pointer-events: none; color: var(--sn-faint); }
#sn-search { width: 100%; padding: 11px 14px 11px 37px; font-family: "DM Sans", sans-serif; font-size: .8rem; color: var(--sn-text); background: transparent; border: 1px solid var(--sn-rule); outline: none; transition: border-color .2s; -webkit-appearance: none; appearance: none; }
#sn-search::placeholder { color: var(--sn-faint); }
#sn-search:focus { border-color: var(--sn-forest); }

/* Visibility helpers */
.sn-offscreen { display: none !important; }
.sn-search-visible { display: flex !important; }
.sn-card-filtered { display: none !important; }
.sn-no-results { grid-column: 1/-1; font-size: .85rem; color: var(--sn-faint); padding: 40px 0; text-align: center; display: none; }

/* Load more */
.sn-load-wrap { text-align: center; margin-top: 44px; }
#sn-load-more { display: inline-flex; align-items: center; gap: 10px; background: transparent; border: 1px solid var(--sn-text); color: var(--sn-text); padding: 13px 38px; font-family: "DM Sans", sans-serif; font-size: .66rem; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; cursor: pointer; transition: background .25s, color .25s, border-color .25s; }
#sn-load-more:hover { background: var(--sn-forest); border-color: var(--sn-forest); color: #fff; }
#sn-load-more svg { width: 13px; height: 13px; }

/* Category buttons */
.sn-cat-group { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.sn-cat-btn { background: transparent; border: 1px solid var(--sn-rule); color: var(--sn-forest); font-size: .7rem; font-weight: 500; padding: 8px 16px; cursor: pointer; border-radius: 999px; transition: all .25s ease; font-family: "DM Sans", sans-serif; letter-spacing: .12em; text-transform: uppercase; line-height: 1; }
.sn-cat-btn:hover { border-color: var(--sn-forest); background: rgba(0,63,46,.06); color: var(--sn-forest); }
.sn-cat-btn.active { background: var(--sn-forest); color: #fff; border-color: var(--sn-forest); box-shadow: 0 2px 8px rgba(0,0,0,.08); }

/* ── Responsive ── */
@media (max-width: 1100px) {
    .sn-grid-more { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 900px) {
    .sn-wrap { padding: 0 28px 60px; }
    .sn-featured { grid-template-columns: 1fr; }
    .sn-featured-img { min-height: 280px; aspect-ratio: 16/9; }
    .sn-featured-body { padding: 32px 32px 36px; }
    .sn-featured-body::before { display: none; }
    .sn-grid-latest { grid-template-columns: 1fr 1fr; }
    .sn-grid-more { grid-template-columns: repeat(2, 1fr); }
    .sn-more-head { flex-direction: column; align-items: flex-start; }
    .sn-search-wrap { max-width: 100%; width: 100%; }
}
@media (max-width: 560px) {
    .sn-wrap { padding: 0 16px 48px; }
    .sn-featured-img { min-height: 220px; }
    .sn-featured-body { padding: 24px 20px 28px; }
    .sn-featured-title { font-size: 1.5rem; }
    .sn-grid-latest { grid-template-columns: 1fr; }
    .sn-grid-more { grid-template-columns: 1fr; }
    .sn-search-wrap { max-width: 100%; }
}
</style>
<?php
    $output = ob_get_clean();

    // ---- Build HTML ----
    $output .= '<div class="sn-wrap">';

    // ── A. FEATURED ──────────────────────────────────────────────────────────
    $f_src  = !empty($featured->source->name) ? esc_html($featured->source->name) : '';
    $f_date = $format_date($featured);

    $output .= '<a href="' . esc_url($featured->link) . '" target="_blank" rel="noopener" class="sn-featured">

    <div class="sn-featured-img">';

    if (!empty($featured->thumbnail)) {
        $output .= '<img src="' . esc_url($featured->thumbnail) . '"'
            . ' alt="' . esc_attr($featured->title) . '"'
            . ' loading="lazy"'
            . ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
            . '<div class="sn-img-ph" style="display:none">' . $icon_ph . '</div>';
    } else {
        $output .= '<div class="sn-img-ph">' . $icon_ph . '</div>';
    }

    $output .= '</div>

    <div class="sn-featured-body">

        <span class="sn-cover-label">Featured Story</span>

        <h2 class="sn-featured-title">' . esc_html($featured->title) . '</h2>

        <div class="sn-featured-ornament">
            <div class="sn-featured-ornament-line"></div>
            <div class="sn-featured-ornament-diamond"></div>
        </div>

        <div class="sn-meta">
            ' . ($f_src  ? '<span>' . $f_src . '</span>' : '') . '
            ' . ($f_src && $f_date ? '<span class="sn-meta-dot"></span>' : '') . '
            ' . ($f_date ? '<span>' . $f_date . '</span>' : '') . '
        </div>

        <span class="sn-read-more">
            Read Full Story
            <span class="sn-read-more-arr">
                ' . $icon_read_more_arrow . '
            </span>
        </span>

    </div>

</a>';

    // ── B. LATEST STORIES (3-col) ─────────────────────────────────────────────
    if (!empty($latest)) {
        $output .= '<div class="sn-section-head"><span>Recent News</span></div><div class="sn-grid-latest">';
        foreach ($latest as $a) {
            $src  = !empty($a->source->name) ? esc_html($a->source->name) : '';
            $date = $format_date($a);
            $output .= '<a href="' . esc_url($a->link) . '" target="_blank" rel="noopener" class="sn-card">
    <div class="sn-card-img">';
            if (!empty($a->thumbnail)) {
                $output .= '<img src="' . esc_url($a->thumbnail) . '"'
                    . ' alt="' . esc_attr($a->title) . '"'
                    . ' loading="lazy"'
                    . ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    . '<div class="sn-card-ph" style="display:none">' . $icon_ph . '</div>';
            } else {
                $output .= '<div class="sn-card-ph">' . $icon_ph . '</div>';
            }
            $output .= '</div>
    ' . ($src  ? '<span class="sn-card-source">' . $src . '</span>' : '') . '
    <h3 class="sn-card-title">' . esc_html($a->title) . '</h3>
    ' . ($date ? '<span class="sn-card-date">' . $date . '</span>' : '') . '
</a>';
        }
        $output .= '</div>';
    }

    // ── C. MORE STORIES (4-col, sorted newest first via centralized sort) ─────
    // NOTE: No additional usort() needed here. The data is already sorted
    // globally by get_sauna_news_data() before we ever sliced it.
    if (!empty($more_raw)) {

        $categories = array(
            array(
                'label'    => 'Wellness',
                'keywords' => 'sauna wellness,sauna therapy,relaxation,spa,mental health,stress relief,detox,immune system,longevity,cardiovascular,mindfulness,rejuvenation,self-care,cold plunge,heat therapy,aromatherapy,fitness,recovery,holistic health',
            ),
            array(
                'label'    => 'Culture',
                'keywords' => 'sauna culture,finnish sauna,hot springs,cultural traditions,sauna rituals,travel,scandinavian wellness,outdoor sauna,heritage,community sauna,sauna festival,sauna retreat,sauna lifestyle',
            ),
            array(
                'label'    => 'Tech &amp; Innovation',
                'keywords' => 'sauna innovation,sauna technology,smart sauna,ai sauna,iot sauna,automated sauna,sauna sensors,infrared technology,energy-efficient sauna,biohacking,wearable tech,vr sauna,sauna startup,sauna gadgets',
            ),
        );

        $cat_buttons_html = '<button class="sn-cat-btn sn-cat-all active">All</button>';
        foreach ( $categories as $cat ) {
            $cat_buttons_html .= '<button class="sn-cat-btn" data-keywords="' . esc_attr( $cat['keywords'] ) . '">'
                . $cat['label']
                . '</button>';
        }

        $output .= '<div class="sn-section-head"><span>More News</span></div>
<div class="sn-more-head">
    <div class="sn-cat-group">
        ' . $cat_buttons_html . '
    </div>
    <div class="sn-search-wrap">' . $icon_search . '
        <input type="search" id="sn-search" placeholder="Search news..." autocomplete="off" aria-label="Search more news">
    </div>
</div>
<div class="sn-grid-more" id="sn-more-grid">';

        foreach (array_values($more_raw) as $idx => $a) {
            $src        = !empty($a->source->name) ? esc_html($a->source->name) : '';
            $date       = $format_date($a);
            $title_attr = esc_attr($a->title);
            $cls = ($idx >= 8) ? ' sn-offscreen' : '';

            $output .= '<a href="' . esc_url($a->link) . '" target="_blank" rel="noopener"'
                . ' class="sn-card' . $cls . '"'
                . ' data-title="' . strtolower($title_attr) . '"'
                . ' data-index="' . $idx . '">
    <div class="sn-card-img">';
            if (!empty($a->thumbnail)) {
                $output .= '<img src="' . esc_url($a->thumbnail) . '"'
                    . ' alt="' . $title_attr . '"'
                    . ' loading="lazy"'
                    . ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                    . '<div class="sn-card-ph" style="display:none">' . $icon_ph . '</div>';
            } else {
                $output .= '<div class="sn-card-ph">' . $icon_ph . '</div>';
            }
            $output .= '</div>
    ' . ($src  ? '<span class="sn-card-source">' . $src . '</span>' : '') . '
    <h3 class="sn-card-title">' . esc_html($a->title) . '</h3>
    ' . ($date ? '<span class="sn-card-date">' . $date . '</span>' : '') . '
</a>';
        }

        $output .= '<p class="sn-no-results" id="sn-no-results">No news match your search.</p>
</div>
<div class="sn-load-wrap">
    <button id="sn-load-more">' . $icon_load . ' Load More News</button>
</div>';
    }

    $output .= '</div><!-- /.sn-wrap -->';

    // ── JavaScript ────────────────────────────────────────────────────────────
    $output .= '
<script>
(function(){
    var BATCH   = 8;
    var grid    = document.getElementById("sn-more-grid");
    var btn     = document.getElementById("sn-load-more");
    var srch    = document.getElementById("sn-search");
    var noRes   = document.getElementById("sn-no-results");
    if (!grid) return;

    var all = Array.prototype.slice.call(grid.querySelectorAll(".sn-card"));

    function offscreen(c){ return c.classList.contains("sn-offscreen"); }
    function filtered(c){ return c.classList.contains("sn-card-filtered"); }
    function searchVisible(c){ return c.classList.contains("sn-search-visible"); }

    function unloadedCount(){
        return all.filter(function(c){ return offscreen(c) && !searchVisible(c); }).length;
    }

    function updateBtn(){
        if (!btn) return;
        var q = srch ? srch.value.trim() : "";
        var activeBtn = document.querySelector(".sn-cat-btn.active:not(.sn-cat-all)");
        btn.style.display = (!q && !activeBtn && unloadedCount() > 0) ? "inline-flex" : "none";
    }

    function visibleCount(){
        return all.filter(function(c){
            return (!offscreen(c) && !filtered(c)) ||
                   (searchVisible(c) && !filtered(c));
        }).length;
    }

    function checkEmpty(){
        if (noRes) noRes.style.display = visibleCount() === 0 ? "block" : "none";
    }

    function applyFilters(){
        var q = srch ? srch.value.trim().toLowerCase() : "";
        var activeBtn = document.querySelector(".sn-cat-btn.active:not(.sn-cat-all)");
        var catKeywords = activeBtn
            ? activeBtn.dataset.keywords.split(",").map(function(k){ return k.trim(); })
            : null;

        all.forEach(function(c){
            var title = c.dataset.title || "";
            var matchesSearch = !q || title.indexOf(q) !== -1;
            var matchesCat = !catKeywords || catKeywords.some(function(k){ return title.indexOf(k) !== -1; });

            if (!q && !catKeywords) {
                c.classList.remove("sn-search-visible");
                c.classList.remove("sn-card-filtered");
            } else if (matchesSearch && matchesCat) {
                c.classList.remove("sn-card-filtered");
                if (offscreen(c)) { c.classList.add("sn-search-visible"); }
            } else {
                c.classList.remove("sn-search-visible");
                c.classList.add("sn-card-filtered");
            }
        });

        updateBtn();
        checkEmpty();
    }

    if (btn) {
        btn.addEventListener("click", function(){
            var hidden = all.filter(function(c){ return offscreen(c) && !searchVisible(c); });
            var count = 0;
            for (var i = 0; i < hidden.length && count < BATCH; i++) {
                hidden[i].classList.remove("sn-offscreen");
                count++;
            }
            updateBtn();
            checkEmpty();
        });
    }

    if (srch) {
        srch.addEventListener("input", function(){ applyFilters(); });
    }

    var catBtns = document.querySelectorAll(".sn-cat-btn");
    var allBtn  = document.querySelector(".sn-cat-all");

    catBtns.forEach(function(catBtn){
        catBtn.addEventListener("click", function(){
            var isAllBtn = this.classList.contains("sn-cat-all");
            catBtns.forEach(function(b){ b.classList.remove("active"); });
            if (isAllBtn) {
                allBtn.classList.add("active");
            } else {
                this.classList.add("active");
            }
            applyFilters();
        });
    });

    updateBtn();
    checkEmpty();
})();
</script>';
return $output;
}
/**
 * ==========================================
 * SAUNA NEWS SHORTCODE + CRON-READY CACHE REFRESH
 * ==========================================
 */

// Register shortcode
add_shortcode( 'sauna_news_fetch', 'sauna_news_fetch' );


/**
 * Refresh sauna news cache
 */
function sauna_news_refresh_cache() {

    // Delete old cache
    delete_transient('sauna_news_master_cache');

    // Re-fetch fresh data
    get_sauna_news_data();

    // Optional logging for debugging
    if ( defined('WP_DEBUG') && WP_DEBUG ) {
        $log_file = __DIR__ . '/sauna_cron.log';
        file_put_contents($log_file, date('Y-m-d H:i:s') . " → Sauna news cache refreshed via cron\n", FILE_APPEND);
    }
}


/**
 * Optional: Manual refresh via URL for testing
 * Usage: yoursite.com/?sauna_test_refresh=1
 * ⚠️ Remove after testing!
 */
add_action('init', function() {
    if ( isset($_GET['sauna_test_refresh']) && $_GET['sauna_test_refresh'] == '1' ) {
        sauna_news_refresh_cache();
        echo '✅ Sauna news cache refreshed!';
        exit;
    }
});