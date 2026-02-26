/* =========================================================
   SAUNA PRODUCT FILTERS + ENQUIRY FORM SYSTEM - JS
   ========================================================= */
jQuery(document).ready(function ($) {
    console.log('Initializing Sauna Products System...');
    
    const container = $('#product-details');
    const filterContainer = $('#voltage-filter-container');
    if (!container.length || !filterContainer.length) {
        console.error('Required containers not found!');
        return;
    }

    // Define global variables
    let voltages = [];
    let activeVolume = null;
    let activeCategory = 'all';
    let activeSize = 'all';
    let formHasUnsavedChanges = false;

    /* ---------------- Initialize Products ---------------- */
    function initializeProducts() {
        console.log('Initializing products...');
        
        /* ---------------- Voltage Filter ---------------- */
        const voltageSet = new Set();
        WooProducts.products.forEach(p => {
            if (p.voltage) {
                p.voltage.forEach(v => {
                    const parsed = parseFloat(v.replace('kw','').replace('-','.'));
                    if (!isNaN(parsed)) voltageSet.add(parsed);
                });
            }
        });

        voltages = Array.from(voltageSet).sort((a,b) => a - b);
        const minIndex = 0;
        const maxIndex = voltages.length - 1;

        const filterDiv = $('<div id="voltage-filter"><b>Filter by Capacity</b></div>');
        filterDiv.append(
            '<div class="voltage-slider">' +
                '<div class="voltage-values">' +
                    '<strong><span id="voltage-min">' + voltages[minIndex] + '</span>kw</strong>' +
                    '<span> – </span>' +
                    '<strong><span id="voltage-max">' + voltages[maxIndex] + '</span>kw</strong>' +
                '</div>' +
                '<div class="slider-wrap">' +
                    '<label for="slider-min">Min Capacity</label>' +
                    '<input type="range" id="slider-min" min="' + minIndex + '" max="' + maxIndex + '" value="' + minIndex + '">' +
                    '<label for="slider-max">Max Capacity</label>' +
                    '<input type="range" id="slider-max" min="' + minIndex + '" max="' + maxIndex + '" value="' + maxIndex + '">' +
                '</div>' +
            '</div>'
        );
        filterContainer.append(filterDiv);

        /* ---------------- Volume Search ---------------- */
        const searchFilter = $(`
            <div id="volume-search-filter">
                <b>Search by Room Size (m³)</b>
                <input type="text" id="volume-search" placeholder="e.g., 5m3" style="
                    padding:6px 8px;
                    border-radius:6px;
                    border:1px solid #ddd;
                    width:100%;
                    font-family: 'Montserrat', sans-serif;
                    margin-bottom:10px;
                ">
            </div>
        `);
        filterContainer.prepend(searchFilter);

        $('#volume-search').on('input', function() {
            const val = $(this).val().trim();
            const match = val.match(/([\d\.]+)/);
            activeVolume = match ? parseFloat(match[1]) : null;
            filterProducts();
        });

        /* ---------------- Filter by Size (Dropdown) ---------------- */
        const sizeSet = new Set();
        WooProducts.products.forEach(p => {
            if (p.size) p.size.forEach(s => sizeSet.add(s));
        });

        const sizeOrder = ['Small', 'Medium', 'Large', 'Extra-large'];
        const sizeFilter = $('<div id="size-filter"><b>Filter by Room Size</b></div>');
        const sizeSelect = $('<select id="size-select" class="filter-dropdown"><option value="all">All Sizes</option></select>');

        const sizeMap = {};
        sizeSet.forEach(size => {
            let formatted = size.toLowerCase();
            if (formatted.includes('small')) formatted = 'Small Sauna';
            else if (formatted.includes('medium')) formatted = 'Medium Sauna';
            else if (formatted.includes('large') && !formatted.includes('extra')) formatted = 'Large Sauna';
            else if (formatted.includes('extra')) formatted = 'Extra-large Sauna';
            sizeMap[size] = formatted;
        });

        sizeOrder.forEach(orderSize => {
            for (const [orig, formatted] of Object.entries(sizeMap)) {
                if (formatted.startsWith(orderSize)) {
                    sizeSelect.append('<option value="'+orig+'">'+formatted+'</option>');
                }
            }
        });

        sizeFilter.append(sizeSelect);
        filterContainer.prepend(sizeFilter);

        /* ---------------- Info Tooltip for Size Dropdown ---------------- */
        const infoIcon = $('<span id="size-info-icon">i</span>');
        const tooltip = $(`
            <div id="size-tooltip">
                Small Sauna: &lt;5m³<br>
                Medium Sauna: 6–14m³<br>
                Large Sauna: 15–24m³<br>
                Extra-large Sauna: &gt;25m³
            </div>
        `);

        const sizeWrapper = $('<div class="size-dropdown-wrapper" style="position:relative; display:inline-block; width:100%;"></div>');
        sizeSelect.wrap(sizeWrapper);
        sizeSelect.parent().append(infoIcon);
        sizeSelect.parent().append(tooltip);

        // Touch device detection
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints;

        if (isTouchDevice) {
            infoIcon.on('click', function(e){
                e.stopPropagation();
                const offset = infoIcon.position();
                tooltip.css({
                    top: offset.top + 'px',
                    left: offset.left + infoIcon.outerWidth() + 6 + 'px'
                }).toggle();
            });

            $(document).on('click touchstart', function(){
                tooltip.hide();
            });
        } else {
            infoIcon.on('mouseenter', function() {
                const offset = infoIcon.position();
                tooltip.css({
                    top: offset.top + 'px',
                    left: offset.left + infoIcon.outerWidth() + 6 + 'px'
                }).show();
            });

            infoIcon.on('mouseleave', function() {
                tooltip.hide();
            });
        }

        /* ---------------- Categories ---------------- */
        const categorySet = new Set();
        WooProducts.products.forEach(p => {
            if (p.categories) p.categories.forEach(c => categorySet.add(c));
        });

        const catFilter = $('<div id="category-filter"><b>Filter by Series</b></div>');
        catFilter.append('<button class="cat-btn active" data-cat="all">All</button>');
        Array.from(categorySet).forEach(cat => {
            catFilter.append('<button class="cat-btn" data-cat="'+cat+'">'+cat.replace('-',' ')+'</button>');
        });
        filterContainer.append(catFilter);

        /* ---------------- Tags with Show More / Less / Reset ---------------- */
        const tagSet = new Set();
        WooProducts.products.forEach(p => {
            if (p.tags) p.tags.forEach(t => tagSet.add(t));
        });

        const tagFilter = $(`
            <div id="tag-filter">
                <b>
                    Filter by Model
                    <span class="tag-toggle-icon">&#x25BC;</span>
                </b>
                <div class="tag-grid"></div>
                <div class="tag-actions" style="margin-top:4px; font-size:12px;">
                    <span class="show-more-text" style="cursor:pointer; color:#af8564; margin-right:10px;">Show More</span>
                    <span class="show-less-text" style="cursor:pointer; color:#af8564; margin-right:10px; display:none;">Show Less</span>
                    <span class="reset-tags-text" style="cursor:pointer; color:#af8564; display:none;">Reset</span>
                </div>
            </div>
        `);

        const tagGrid = tagFilter.find('.tag-grid');
        const tagActions = tagFilter.find('.tag-actions');
        const showMore = tagActions.find('.show-more-text');
        const showLess = tagActions.find('.show-less-text');
        const resetTags = tagActions.find('.reset-tags-text');

        const sortedTags = Array.from(tagSet).sort();
        sortedTags.forEach(tag => {
            tagGrid.append(
                '<label class="tag-item">' +
                    '<input type="checkbox" value="'+tag+'">' +
                    '<span>'+tag.replace('-',' ')+'</span>' +
                '</label>'
            );
        });

        filterContainer.append(tagFilter);

        let tagsVisibleCount = 5;
        const tagItems = tagGrid.find('.tag-item');

        function updateTagVisibility() {
            const totalTags = tagItems.length;

            tagItems.hide();
            tagItems.slice(0, tagsVisibleCount).show();

            if (tagsVisibleCount >= totalTags) {
                showMore.hide();
                showLess.show();
            } else if (tagsVisibleCount <= 5) {
                showMore.show();
                showLess.hide();
            } else {
                showMore.show();
                showLess.show();
            }

            const anyChecked = tagFilter.find('input[type="checkbox"]:checked').length > 0;
            resetTags.toggle(anyChecked);
        }

        let tagOpen = false;
        tagFilter.find('b').on('click', function(){
            tagOpen = !tagOpen;
            tagGrid.slideToggle(200);
            tagActions.slideToggle(200);
            const icon = $(this).find('.tag-toggle-icon');
            icon.html(tagOpen ? '&#x25B2;' : '&#x25BC;');
            updateTagVisibility();
        });

        showMore.on('click', function(){
            tagsVisibleCount += 5;
            updateTagVisibility();
        });

        showLess.on('click', function(){
            tagsVisibleCount = 5;
            updateTagVisibility();
        });

        resetTags.on('click', function(){
            tagFilter.find('input[type="checkbox"]').prop('checked', false);
            filterProducts();
            updateTagVisibility();
        });

        tagFilter.on('change', 'input[type="checkbox"]', function() {
            updateTagVisibility();
        });

        updateTagVisibility();

        /* ---------------- Render Products ---------------- */
        WooProducts.products.forEach(product => {
            if (!product.image) return;

            const voltageData  = product.voltage ? product.voltage.join(' ') : '';
            const categoryData = product.categories ? product.categories.join(' ') : '';
            const tagsData     = product.tags ? product.tags.join(' ') : '';
            const sizeData     = product.size ? product.size.join(' ') : '';
            const productId    = product.name.replace(/\s+/g, '-').toLowerCase();

container.append(
    '<div class="sauna-product-card" data-voltage="'+voltageData+'" data-category="'+categoryData+'" data-tags="'+tagsData+'" data-size="'+sizeData+'" data-id="'+productId+'" data-name="'+product.name+'" data-image="'+product.image+'">' +
        '<div class="sauna-product-thumbsup" title="Add to favorites">' +
            '<i class="fas fa-heart thumbsup-icon"></i>' +
        '</div>' +
        '<a href="'+product.link+'" target="_blank" rel="noopener">' +
            '<img src="'+product.image+'" class="sauna-product-img" loading="lazy">' +
        '</a>' +
        '<h3 class="sauna-product-title">'+product.name+'</h3>' +
        '<p class="sauna-product-desc">'+product.short_description+'</p>' +
    '</div>'
);
        });

        const loader = $('<div id="products-loader" style="display:none;text-align:center;margin:20px 0;">Loading...</div>');
        container.before(loader);

        /* ---------------- Add Header Enquire Now Button ---------------- */
        addHeaderEnquireButton();
        
        /* ---------------- Initialize Enquiry Form ---------------- */
        initEnquiryForm();
        
        /* ---------------- Check Existing Favorites ---------------- */
        checkExistingFavorites();
        
        /* ---------------- Initialize Filters ---------------- */
        initializeFilters();
        
        console.log('Products initialization complete.');
    }

    /* ---------------- ADD HEADER ENQUIRE BUTTON ---------------- */
  function addHeaderEnquireButton() {
    console.log('Adding header enquire button...');
    
    // Remove any existing
    $('#enquire-now-header').closest('li').remove();
    $('.favorites-header-btn').remove();
    
const buttonHTML = `
    <button id="enquire-now-header" class="favorites-header-btn" style="
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        background: #af8564 !important;
        color: white !important;
        border: none !important;
        padding: 10px 20px !important;
        border-radius: 4px !important;
        font-family: 'Montserrat', sans-serif !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        cursor: pointer !important;
        position: relative !important;
        z-index: 999999 !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: auto !important;
        height: 40px !important;
        left:90px;
        top:20px;
    ">
        <i class="fas fa-heart"></i> Favorites
        <span class="enquire-badge" style="
            position: absolute !important;
            top: -8px !important;
            right: -8px !important;
            background: #e74c3c !important;
            color: white !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            min-width: 18px !important;
            height: 18px !important;
            border-radius: 9px !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 4px !important;
        ">0</span>
    </button>
`;
    
    let inserted = false;
    
    // Try menu insertion first
    if ($('.fusion-main-menu > ul').length) {
        $('.fusion-main-menu > ul').append(`
            <li style="display: flex !important; align-items: center !important; list-style: none !important;">
                ${buttonHTML}
            </li>
        `);
        inserted = true;
        console.log('Inserted into menu');
    }
    
    // FALLBACK: Always create fixed position version as backup
    if (!$('#enquire-now-header').is(':visible')) {
        console.warn('Button not visible, using fixed position fallback');
        $('body').append(`
            <div style="
                position: fixed !important;
                top: 20px !important;
                right: 160px !important;
                z-index: 999999 !important;
                display: block !important;
            ">
                ${buttonHTML}
            </div>
        `);
    }
    
    // Force visibility after insertion
    setTimeout(() => {
        const btn = $('#enquire-now-header');
        console.log('Button exists:', btn.length);
        console.log('Button visible:', btn.is(':visible'));
        console.log('Button CSS display:', btn.css('display'));
        
        if (!btn.is(':visible')) {
            console.error('BUTTON STILL HIDDEN - Check Avada theme CSS');
            // Last resort: use jQuery .show()
            btn.show().css({
                'display': 'inline-flex',
                'visibility': 'visible',
                'opacity': '1'
            });
        }
    }, 500);
    
$(document).on('click', '#enquire-now-header', function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('=== FAVORITES BUTTON CLICKED ===');
    
    // Get fresh favorites from storage
    const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
    const favoriteIds = Object.keys(favorites);
    
    console.log('Current favorites count:', favoriteIds.length);
    
    // Validate favorites exist
    if (favoriteIds.length === 0) {
        console.warn('No favorites found!');
        showNotification('Please add some favorites first! Click the 👍 on products.', '#af8564');
        return false;
    }
    
    // CRITICAL: Ensure form is fresh before showing
    if ($('.success-message').length) {
        console.log('Success message detected, reinitializing form...');
        initEnquiryForm();
    }
    
    // Show form
    console.log('Opening enquiry form with', favoriteIds.length, 'favorites');
    showEnquiryForm();
    
    return false;
});
    updateHeaderEnquireButton();
}
    
    function updateHeaderEnquireButton() {
        const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
        const favoriteIds = Object.keys(favorites);
        const headerButton = $('#enquire-now-header');
        const badge = headerButton.find('.enquire-badge');
        
        if (favoriteIds.length > 0) {
            headerButton.prop('disabled', false);
            badge.text(favoriteIds.length).show();
        } else {
            headerButton.prop('disabled', true);
            badge.hide();
        }
    }

    /* ---------------- ENQUIRY FORM FUNCTIONS ---------------- */
    function initEnquiryForm() {
        console.log('Initializing enquiry form...');
        
        const formHTML = `
        <div class="enquiry-form-container">
            <div class="form-header">
                <h2><i class="fas fa-file-alt"></i> Product Inquiry Form</h2>
                <p>Fill in your details and we'll get back to you promptly</p>
            </div>
            
            <form id="enquiryForm" class="form-body">
                <!-- Selected Favorites with Thumbnails -->
                <div class="form-group full-width">
                    <div class="products-section">
                        <div class="products-header">
                            <h3><i class="fas fa-heart"></i> Selected Favorites</h3>
                            <span class="product-count" id="productCount">0 items</span>
                        </div>
                        <div class="favorites-list" id="favoritesList">
                            <p class="no-products">No products selected. Please add favorites first.</p>
                        </div>
<button type="button" id="addMoreProducts" class="add-more-btn">
    <i class="fas fa-plus-circle"></i> Add More Products
</button>

                    </div>
                </div>

                <!-- Row 1: Name -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-user"></i> First Name<span class="required">*</span>
                        </label>
                        <input type="text" id="firstname" class="form-input" placeholder="Enter first name" required>
                        <div class="error-message" id="firstnameError">Please enter your first name</div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-user"></i> Last Name<span class="required">*</span>
                        </label>
                        <input type="text" id="lastname" class="form-input" placeholder="Enter last name" required>
                        <div class="error-message" id="lastnameError">Please enter your last name</div>
                    </div>
                </div>
                
                <!-- Row 2: Contact Info -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-envelope"></i> Email<span class="required">*</span>
                        </label>
                        <input type="email" id="email" class="form-input" placeholder="your.email@example.com" required>
                        <div class="error-message" id="emailError">Please enter a valid email address</div>
                    </div>
                </div>
                
                <!-- Row 3: Phone -->
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">
                            <i class="fas fa-phone"></i> Phone<span class="required">*</span>
                        </label>
                        <input type="tel" id="phone" class="form-input" placeholder="Phone number" required>
                        <div class="error-message" id="phoneError">Please enter a valid phone number</div>
                    </div>
                </div>
                
                <!-- Row 4: Location -->
                <div class="form-row">
                    <div class="form-group full-width">
                        <label class="form-label">
                            <i class="fas fa-map-marker-alt"></i> Location
                        </label>
                        <div class="location-wrapper">
                            <input type="text" id="location" class="form-input readonly" placeholder="Location will be auto-detected" readonly>
                        </div>
                    </div>
                </div>
                
                <!-- Row 5: Description -->
                <div class="form-row">
                    <div class="form-group full-width">
                        <label class="form-label">
                            <i class="fas fa-comment"></i> Additional Comments
                        </label>
                        <textarea id="description" class="form-input" placeholder="Please provide additional comments or specific inquiries...." rows="4"></textarea>
                    </div>
                </div>
                
                <!-- Form Actions -->
                <div class="form-actions">
                    <button type="button" id="clearForm" class="clear-btn">
                        <i class="fas fa-times"></i> Clear All
                    </button>
                    <button type="submit" id="submitForm" class="submit-btn">
                        <i class="fas fa-paper-plane"></i> Submit Inquiry
                    </button>
                </div>
            </form>
        </div>`;
        
        $('#enquiryFormContainer').html(formHTML);
        bindEnquiryFormEvents();
        updateEnquiryForm();
        
        // Auto-detect location
        autoDetectLocation();
    }

    function bindEnquiryFormEvents() {
        console.log('Binding enquiry form events...');
        
        // Close popup
        $('#closeEnquiryPopup').on('click', function() {
            if (formHasUnsavedChanges || hasFormData()) {
                showCloseConfirmation();
            } else {
                closeEnquiryPopup();
            }
        });
        
        // Close popup when clicking outside
        $('.enquiry-popup-overlay').on('click', function(e) {
            if (e.target === this) {
                if (formHasUnsavedChanges || hasFormData()) {
                    showCloseConfirmation();
                } else {
                    closeEnquiryPopup();
                }
            }
        });
        
        // Escape key to close popup
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && $('.enquiry-popup-overlay').is(':visible')) {
                if (formHasUnsavedChanges || hasFormData()) {
                    showCloseConfirmation();
                } else {
                    closeEnquiryPopup();
                }
            }
        });
        
        // Track form changes
        $(document).on('input', '#enquiryForm input, #enquiryForm textarea', function() {
            formHasUnsavedChanges = true;
        });
        
        // Remove favorite from modal
        $(document).on('click', '.remove-favorite', function(e) {
            e.preventDefault();
            const productId = $(this).data('id');
            showDeleteConfirmation(productId);
        });
        
        // Clear form
        $(document).on('click', '#clearForm', function(e) {
            e.preventDefault();
            if (hasFormData()) {
                if (confirm('Are you sure you want to clear all form data?')) {
                    clearEnquiryForm();
                }
            } else {
                clearEnquiryForm();
            }
        });
        
        // Submit form
        $(document).on('submit', '#enquiryForm', function(e) {
            e.preventDefault();
            submitEnquiryForm();
        });
        
    // Add More Products button - just close the form
$(document).on('click', '#addMoreProducts', function(e) {
    e.preventDefault();
    closeEnquiryPopup();
});
// Start new enquiry (from success message)
$(document).on('click', '#newEnquiry', function() {
    console.log('Close button clicked from success message');
    
    // STEP 1: Reinitialize form FIRST
    initEnquiryForm();
    
    // STEP 2: Close popup
    closeEnquiryPopup();
    
    // STEP 3: Auto-clear favorites after successful submission
    localStorage.removeItem('saunaFavorites');
    
    // STEP 4: Force refresh UI
    checkExistingFavorites();
    updateEnquiryForm();
    updateHeaderEnquireButton();
    
    // STEP 5: Scroll to products
    $('html, body').animate({
        scrollTop: $('#product-details').offset().top - 100
    }, 500);
});


        // Real-time validation
        $(document).on('blur', '.form-input', function() {
            if ($(this).attr('required')) {
                if ($.trim($(this).val()) === '') {
                    $(this).addClass('error');
                } else {
                    $(this).removeClass('error');
                }
            }
        });
    }

    function updateEnquiryForm() {
        const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
        const favoriteIds = Object.keys(favorites);
        const favoritesList = $('#favoritesList');
        const productCount = $('#productCount');
        
        // Update counts
        productCount.text(favoriteIds.length + ' item' + (favoriteIds.length !== 1 ? 's' : ''));
        
        // Update favorites list with thumbnails
        if (favoriteIds.length > 0) {
            favoritesList.empty();
            
            favoriteIds.forEach(productId => {
                const product = favorites[productId];
                let productImage = product.image || '';
                
                // Try to get image from DOM if not in localStorage
                if (!productImage) {
                    const productCard = $(`.sauna-product-card[data-id="${productId}"]`);
                    if (productCard.length) {
                        productImage = productCard.find('img').attr('src') || '';
                    }
                }
                
                const favoriteItem = $(`
                    <div class="favorite-item">
                        ${productImage ? `<img src="${productImage}" class="favorite-item-img" alt="${product.name}">` : '<div class="favorite-item-img" style="background:#ddd;"></div>'}
                        <div class="favorite-item-info">
                            <h4 class="favorite-item-name">${product.name}</h4>
                        </div>
                        <button class="remove-favorite" data-id="${productId}" title="Remove from favorites">×</button>
                    </div>
                `);
                favoritesList.append(favoriteItem);
            });
        } else {
            favoritesList.html('<p class="no-products">No products selected. Please add favorites first.</p>');
        }
        
        // Update header button
        updateHeaderEnquireButton();
    }

function showEnquiryForm() {
    console.log('Showing enquiry form...');
    
    // VALIDATE AGAIN before showing
    const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
    const favoriteIds = Object.keys(favorites);
    
    if (favoriteIds.length === 0) {
        console.warn('Attempted to open form with no favorites!');
        showNotification('No favorites found! Please add products first.', '#e74c3c');
        return; // Don't open form
    }
    
    // Update form content
    updateEnquiryForm();
    
    // Show popup
    $('.enquiry-popup-overlay').addClass('show').fadeIn();
    $('body').css('overflow', 'hidden');
    formHasUnsavedChanges = false;
    
    setTimeout(() => {
        $('#firstname').focus();
    }, 300);
}

    async function autoDetectLocation() {
        try {
            console.log('Auto-detecting location...');
            
            // Try ipapi.co first
            const response = await fetch('https://ipapi.co/json/');
            if (response.ok) {
                const data = await response.json();
                $('#location').val(data.country_name || 'Unknown location');
                console.log('Location detected via ipapi:', data.country_name);
                showNotification('Location detected successfully!', '#2ecc71');
                return;
            }
        } catch (error) {
            console.error("Error fetching location from ipapi:", error);
        }
        
        // Fallback to browser geolocation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async function(position) {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await response.json();
                        const country = data.address.country || data.address.country_code || '';
                        $('#location').val(country);
                        console.log('Location detected via geolocation:', country);
                        showNotification('Location detected via geolocation!', '#2ecc71');
                    } catch (error) {
                        console.error("Error with reverse geocoding:", error);
                        $('#location').val('Location detected (coordinates only)');
                    }
                },
                function(error) {
                    console.error("Geolocation error:", error);
                    $('#location').val('Location permission denied');
                }
            );
        } else {
            $('#location').val('Location detection not available');
        }
    }

    function validateForm() {
        let isValid = true;       
        $('.error-message').hide();
        $('.form-input').removeClass('error');       
        const requiredFields = [
            { id: 'firstname', errorId: 'firstnameError', message: 'Please enter your first name' },
            { id: 'lastname', errorId: 'lastnameError', message: 'Please enter your last name' },
            { id: 'email', errorId: 'emailError', message: 'Please enter a valid email address' },
            { id: 'phone', errorId: 'phoneError', message: 'Please enter a valid phone number' }
        ];      
        requiredFields.forEach(field => {
            const $input = $('#' + field.id);
            const $error = $('#' + field.errorId);          
            if (!$.trim($input.val())) {
                $input.addClass('error');
                $error.text(field.message).show();
                isValid = false;
            }
        });       
        const email = $('#email').val();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (email && !emailRegex.test(email)) {
            $('#email').addClass('error');
            $('#emailError').text('Please enter a valid email address').show();
            isValid = false;
        }       
        const phone = $('#phone').val();
        const phoneRegex = /^[\d\s\-\+\(\)]{10,}$/;
        if (phone && !phoneRegex.test(phone)) {
            $('#phone').addClass('error');
            $('#phoneError').text('Please enter a valid phone number').show();
            isValid = false;
        }      
        return isValid;
    }
    
    // async function submitEnquiryForm() {
    //     if (!validateForm()) {
    //         return;
    //     }
        
    //     // Get public IP
    //     let userIP = 'unknown';
    //     try {
    //         const ipResponse = await fetch('https://api.ipify.org?format=json');
    //         const ipData = await ipResponse.json();
    //         userIP = ipData.ip;
    //     } catch (error) {
    //         console.error("Error getting IP:", error);
    //     }
        
    //     const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
    //     const formData = {
    //         firstName: $('#firstname').val(),
    //         lastName: $('#lastname').val(),
    //         email: $('#email').val(),
    //         phone: $('#phone').val(),
    //         date: new Date().toISOString().split('T')[0], // Auto-date
    //         timestamp: new Date().toISOString(),
    //         location: $('#location').val(),
    //         description: $('#description').val(),
    //         products: favorites,
    //         ip: userIP
    //     };      
        
    //     $('#submitForm').html('<i class="fas fa-spinner fa-spin"></i> Sending...').prop('disabled', true);    
        
    //     // Simulate API call
    //     setTimeout(() => {
    //         $('#enquiryFormContainer').html(`
    //             <div class="success-message">
    //                 <i class="fas fa-check-circle"></i>
    //                 <h3>Enquiry Sent Successfully!</h3>
    //                 <p>Thank you for your enquiry. Our team will contact you within 24 hours.</p>
    //                 <p style="font-size: 12px; color: #666; margin-top: 20px;">
    //                     Submission date: ${formData.date}<br>
    //                     Location: ${formData.location}<br>
    //                     IP Address: ${formData.ip}
    //                 </p>
    //                 <button type="button" id="newEnquiry" class="submit-btn" style="margin-top: 30px;">
    //                     <i class="fas fa-plus"></i> Start New Enquiry
    //                 </button>
    //             </div>
    //         `);      
            
    //         // Clear favorites after successful submission
    //         localStorage.removeItem('saunaFavorites');
    //         updateEnquiryForm();
    //         checkExistingFavorites();           
    //         showNotification('Enquiry submitted successfully!', '#2ecc71');
    //     }, 2000);
    // }
    

async function submitEnquiryForm() {
        if (!validateForm()) {
            return;
        }
        
        // Get public IP
        let userIP = 'unknown';
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            userIP = ipData.ip;
        } catch (error) {
            console.error("Error getting IP:", error);
        }
     

      //  const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '[]');
	
 	   var products = Array.from(document.querySelectorAll('.favorites-list .favorite-item-name'))
 	  .map(el => el.textContent.trim());
     
        const formData = {
            name:  "Inquiry  - " + $('#firstname').val() + " " + $('#lastname').val(),
            email_from: $('#email').val(),
            contact_name: $('#firstname').val() + " " + $('#lastname').val(),
            phone: $('#phone').val(),
            location: $('#location').val(),
            setDate: new Date().toISOString().split('T')[0], // Auto-date
            description: $('#description').val(),
            products: products || [],
        };
	
        const apiUrl = `${window.location.origin}/helpdeskapi/createLeads.php`;

        try{
            $('#submitForm').html('<i class="fas fa-spinner fa-spin"></i> Sending...').prop('disabled', true);  
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
		//console.log(formData);
		//console.log(apiUrl);
       // console.log(response);
            // Simulate API call
            setTimeout(() => {
         $('#enquiryFormContainer').html(`
    <div class="success-message">
        <i class="fas fa-check-circle"></i>
        <h3>Enquiry Sent Successfully!</h3>
        <p>Thank you for your enquiry. Our team will contact you within 24 hours.</p>                    
        <div style="display: flex; justify-content: flex-end; margin-top: 30px;">
            <button type="button" id="newEnquiry" class="submit-btn">
                Close
            </button>
        </div>
    </div>
`);  
                
   // Automatically clear favorites after successful submission
localStorage.removeItem('saunaFavorites');
updateEnquiryForm();
checkExistingFavorites();
showNotification('Enquiry submitted successfully!', '#2ecc71');
            }, 2000);
        } catch(err) {
            console.error("Submit error:", err);
            showNotification('Failed to submit enquiry.', '#e74c3c');
            $('#submitForm').html('Submit').prop('disabled', false);
        }  
    }


    function clearEnquiryForm() {
        $('#enquiryForm')[0].reset();
        $('.error-message').hide();
        $('.form-input').removeClass('error');
        formHasUnsavedChanges = false;
    }
    
function closeEnquiryPopup() {
    $('.enquiry-popup-overlay').removeClass('show').fadeOut();
    $('body').css('overflow', 'auto');
    formHasUnsavedChanges = false;
    
    // CRITICAL: If success message is showing, reinitialize form for next use
    setTimeout(() => {
        if ($('.success-message').length) {
            console.log('Success message detected, reinitializing form...');
            initEnquiryForm();
        }
    }, 400);
}  
    function hasFormData() {
        return $('#firstname').val() || $('#lastname').val() || $('#email').val() || 
               $('#phone').val() || $('#description').val();
    }
    
    function showCloseConfirmation() {
        if (confirm('Are you sure you want to leave?')) {
            closeEnquiryPopup();
        }
    }
    
    function showDeleteConfirmation(productId) {
        if (confirm('Are you sure you want to delete this favorite?')) {
            const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
            delete favorites[productId];
            localStorage.setItem('saunaFavorites', JSON.stringify(favorites));
            
            updateEnquiryForm();
            checkExistingFavorites();
            showNotification('Favorite removed', '#666');
        }
    }

    /* ---------------- EXISTING FAVORITES ---------------- */
    function checkExistingFavorites() {
        const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');    
        $('.sauna-product-card').each(function() {
            const $card = $(this);
            const productId = $card.data('id');      
            if (favorites[productId]) {
                $card.find('.sauna-product-thumbsup').addClass('active');
            } else {
                $card.find('.sauna-product-thumbsup').removeClass('active');
            }
        });    
        updateEnquiryForm();
    }

    /* ---------------- THUMBSUP FUNCTIONALITY ---------------- */
    $(document).on('click', '.sauna-product-thumbsup', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const $thumbsup = $(this);
        const $icon = $thumbsup.find('.thumbsup-icon');
        const $card = $thumbsup.closest('.sauna-product-card');
        const productId = $card.data('id');
        const productName = $card.find('.sauna-product-title').text();
        const productImage = $card.find('img').attr('src');      
        
        $thumbsup.toggleClass('active');
        const isActive = $thumbsup.hasClass('active');
        
        if (isActive) {
            $icon.css('transform', 'scale(1.2)');
            setTimeout(() => {
                $icon.css('transform', 'scale(1)');
            }, 300);
            
            const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
            favorites[productId] = {
                name: productName,
                image: productImage,
                date: new Date().toISOString()
            };
            localStorage.setItem('saunaFavorites', JSON.stringify(favorites));   
            showNotification('Added to Favorites', '#af8564');
        } else {
            const favorites = JSON.parse(localStorage.getItem('saunaFavorites') || '{}');
            delete favorites[productId];
            localStorage.setItem('saunaFavorites', JSON.stringify(favorites));
            showNotification('Removed from favorites', '#666');
        }    
        
        checkExistingFavorites();
        return false;
    });

    /* ---------------- NOTIFICATION FUNCTION ---------------- */
    function showNotification(message, color) {
        $('#thumbsup-notification').remove();   
        const notification = $('<div id="thumbsup-notification"></div>')
            .css({
                position: 'fixed',
                top: '100px',
                right: '20px',
                background: color,
                color: 'white',
                padding: '12px 20px',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: '9999',
                fontFamily: "'Montserrat', sans-serif",
                fontSize: '14px',
                fontWeight: '600',
                transform: 'translateX(150%)',
                transition: 'transform 0.3s ease'
            })
            .text(message)
            .appendTo('body');       
        setTimeout(() => {
            notification.css('transform', 'translateX(0)');
        }, 10);
        setTimeout(() => {
            notification.css('transform', 'translateX(150%)');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /* ---------------- FILTERING LOGIC ---------------- */
    function filterProducts() {
        const loader = $('#products-loader');
        if (loader.length) {
            loader.show();
        }
        
        // First, show all products
        $('.sauna-product-card').show();
        
        // If there are no filters active, just return
        if (activeCategory === 'all' && activeSize === 'all' && !activeVolume) {
            const selectedTags = $('#tag-filter input:checked').map(function(){ return this.value; }).get();
            if (selectedTags.length === 0) {
                if (loader.length) {
                    loader.hide();
                }
                return; // No filters active
            }
        }
        
        setTimeout(() => {
            const minI = parseInt($('#slider-min').val(),10);
            const maxI = parseInt($('#slider-max').val(),10);
            const minVal = voltages[minI];
            const maxVal = voltages[maxI];
            
            // Update voltage display
            if ($('#voltage-min').length && $('#voltage-max').length) {
                $('#voltage-min').text(minVal);
                $('#voltage-max').text(maxVal);
            }

            const selectedTags = $('#tag-filter input:checked').map(function(){ return this.value; }).get();

            $('.sauna-product-card').each(function(){
                const volts = ($(this).data('voltage') || '').split(' ')
                    .map(v => parseFloat(v.replace('kw','').replace('-','.')))
                    .filter(v => !isNaN(v));
                const cats = ($(this).data('category') || '').split(' ');
                const tags = ($(this).data('tags') || '').split(' ');
                const sizes = ($(this).data('size') || '').split(' ');

                const voltageMatch  = volts.length === 0 || volts.some(v => v >= minVal && v <= maxVal);
                const categoryMatch = activeCategory === 'all' || cats.includes(activeCategory);
                const tagMatch      = selectedTags.length === 0 || selectedTags.some(t => tags.includes(t));
                const sizeMatch     = activeSize === 'all' || sizes.includes(activeSize);

                let volumeMatch = true;
                if (activeVolume !== null) {
                    const voltage = volts[0] || 0;
                    if (activeVolume < 5) volumeMatch = voltage >= 2.3 && voltage <= 5;
                    else if (activeVolume >= 6 && activeVolume <= 14) volumeMatch = voltage >= 6 && voltage <= 9;
                    else if (activeVolume >= 15 && activeVolume <= 24) volumeMatch = voltage >= 10.5 && voltage <= 15;
                    else if (activeVolume > 23) volumeMatch = voltage >= 15 && voltage <= 24;
                }

                $(this).toggle(voltageMatch && categoryMatch && tagMatch && sizeMatch && volumeMatch);
            });

            if (loader.length) {
                loader.hide();
            }
        }, 100);
    }

    function initializeFilters() {
        /* ---------------- Slider Events ---------------- */
        $('#slider-min').on('input', function() {
            let minValIndex = parseInt($(this).val(),10);
            let maxValIndex = parseInt($('#slider-max').val(),10);
            if (minValIndex > maxValIndex) minValIndex = maxValIndex;
            $(this).val(minValIndex);
            $('#voltage-min').text(voltages[minValIndex]);
        });

        $('#slider-max').on('input', function() {
            let maxValIndex = parseInt($(this).val(),10);
            let minValIndex = parseInt($('#slider-min').val(),10);
            if (maxValIndex < minValIndex) maxValIndex = minValIndex;
            $(this).val(maxValIndex);
            $('#voltage-max').text(voltages[maxValIndex]);
        });

        $('#slider-min, #slider-max').on('change', filterProducts);
        $('#tag-filter').on('change', 'input', filterProducts);

        /* ---------------- Size Dropdown Event ---------------- */
        $(document).on('change', '#size-select', function(){
            activeSize = $(this).val();
            filterProducts();
        });

        /* ---------------- Category Button Event ---------------- */
        $(document).on('click', '.cat-btn', function(){
            $('.cat-btn').removeClass('active');
            $(this).addClass('active');
            activeCategory = $(this).data('cat');
            filterProducts();
        });

        // Initially show all products
        filterProducts();
    }

    /* ---------------- DEBUG HELPER ---------------- */
    function debugCheck() {
        console.log('=== DEBUG CHECK ===');
        console.log('WooProducts exists:', typeof WooProducts !== 'undefined');
        console.log('WooProducts.products:', WooProducts ? WooProducts.products : 'undefined');
        console.log('Container exists:', container.length);
        console.log('Filter container exists:', filterContainer.length);
        console.log('Header button exists:', $('#enquire-now-header').length);
        console.log('Enquiry popup exists:', $('.enquiry-popup-overlay').length);
        console.log('=== END DEBUG ===');
    }

    /* ---------------- INITIALIZE EVERYTHING ---------------- */
    initializeProducts();
    
    // Check initialization after a short delay
    setTimeout(debugCheck, 1000);
});

console.log(window.location.origin);