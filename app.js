// ============================================================================
// SUPABASE CONFIGURATION
// ============================================================================
// IMPORTANT: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://opfgayxshfhtjnfbflzr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZmdheXhzaGZodGpuZmJmbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzYwMjAsImV4cCI6MjA4Njg1MjAyMH0.ex1pyIAa1VWggeV0bB6XkCnnFWP_yEfHVBN4buVT2ws';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================================
// DOM ELEMENTS (initialized after DOM loads)
// ============================================================================
let entriesContainer;
let newEntryBtn;
let entryModal;
let entryForm;
let cancelBtn;
let closeBtn;

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================
function openModal() {
    entryModal.style.display = 'block';
    if (!currentEditId) {
        entryForm.reset();
    }
}

function closeModal() {
    entryModal.style.display = 'none';
    entryForm.reset();
    currentEditId = null;
    
    // Reset modal title and button text
    document.querySelector('.modal-header h2').textContent = 'New Experiment';
    const submitBtn = entryForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Save Experiment';
    
    // Remove info message if exists
    const infoMsg = entryForm.querySelector('.info-message');
    if (infoMsg) {
        infoMsg.remove();
    }
}

// ============================================================================
// CSV PARSING
// ============================================================================
function parseCSV(csvText) {
    const lines = csvText
        .trim()
        .split('\n')
        .filter(line => line.trim() !== '');

    const data = [];

    // Skip header if it contains "wavelength" or "intensity"
    let startIdx = 0;
    if (lines[0].toLowerCase().includes('wavelength')) {
        startIdx = 1;
    }

    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].trim().split(',');
        if (parts.length >= 2) {
            const x = Number(parts[0].trim());
            const y = Number(parts[1].trim());

            // Validate parsed numbers
            if (!isNaN(x) && !isNaN(y)) {
                data.push({ x, y });
            }
        }
    }

    return data;
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

// ============================================================================
// CHART RENDERING
// ============================================================================
let chartInstances = {};

function normalizeData(data) {
    if (!data || data.length === 0) return [];
    
    // Find min and max y values
    const yValues = data.map(point => point.y);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    const range = maxY - minY;
    
    // Avoid division by zero
    if (range === 0) {
        return data.map(point => ({ x: point.x, y: 0.5 }));
    }
    
    // Normalize to [0, 1]
    return data.map(point => ({
        x: point.x,
        y: (point.y - minY) / range
    }));
}

function calculateEmissionStats(data) {
    if (!data || data.length === 0) return null;
    
    // Find peak (max y value)
    let peak = data[0];
    for (let point of data) {
        if (point.y > peak.y) {
            peak = point;
        }
    }
    
    // Calculate FWHM (Full Width at Half Maximum)
    const halfMax = peak.y / 2;
    let leftX = null;
    let rightX = null;
    
    // Find left crossing point
    for (let i = 0; i < data.length - 1; i++) {
        if (data[i].y <= halfMax && data[i + 1].y >= halfMax) {
            // Linear interpolation
            const ratio = (halfMax - data[i].y) / (data[i + 1].y - data[i].y);
            leftX = data[i].x + ratio * (data[i + 1].x - data[i].x);
            break;
        }
    }
    
    // Find right crossing point
    for (let i = data.length - 1; i > 0; i--) {
        if (data[i].y <= halfMax && data[i - 1].y >= halfMax) {
            // Linear interpolation
            const ratio = (halfMax - data[i].y) / (data[i - 1].y - data[i].y);
            rightX = data[i].x + ratio * (data[i - 1].x - data[i].x);
            break;
        }
    }
    
    const fwhm = (leftX !== null && rightX !== null) ? Math.abs(rightX - leftX) : null;
    
    return {
        peakWavelength: peak.x,
        fwhm: fwhm
    };
}

function createCombinedChart(canvasId, absorptionData, emissionData) {
    // Destroy existing chart if it exists
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    
    // Check if mobile device
    const isMobile = window.innerWidth <= 768;
    
    // Normalize both datasets to [0, 1]
    const normalizedAbsorption = normalizeData(absorptionData);
    const normalizedEmission = normalizeData(emissionData);
    
    // Calculate emission statistics from original data
    const emissionStats = calculateEmissionStats(emissionData);
    let subtitle = '';
    if (emissionStats && emissionStats.peakWavelength) {
        subtitle = `Emission Peak: ${emissionStats.peakWavelength.toFixed(1)} nm`;
        if (emissionStats.fwhm) {
            subtitle += ` | FWHM: ${emissionStats.fwhm.toFixed(1)} nm`;
        }
    }
    
    // Calculate shared x-axis range
    const allXValues = [
        ...normalizedAbsorption.map(p => p.x),
        ...normalizedEmission.map(p => p.x)
    ];
    const minX = Math.min(...allXValues);
    const maxX = Math.max(...allXValues);

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Absorption',
                    data: normalizedAbsorption,
                    borderColor: '#2563eb',  // Blue for absorption
                    backgroundColor: 'rgba(37, 99, 235, 0.0)',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderDash: []  // Solid line
                },
                {
                    label: 'Emission',
                    data: normalizedEmission,
                    borderColor: '#dc2626',  // Red for emission
                    backgroundColor: 'rgba(220, 38, 38, 0.0)',
                    borderWidth: 2.5,
                    tension: 0.2,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    borderDash: []  // Solid line
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: isMobile ? null : 'index',
                intersect: false
            },
            events: isMobile ? [] : ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        font: { size: 11 },
                        usePointStyle: true,
                        boxWidth: 6,
                        padding: 10
                    }
                },
                subtitle: {
                    display: subtitle !== '',
                    text: subtitle,
                    position: 'top',
                    align: 'end',
                    font: {
                        size: 11,
                        weight: 'normal',
                        family: 'monospace'
                    },
                    color: '#666',
                    padding: {
                        bottom: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + 
                                   context.parsed.x.toFixed(1) + ' nm, ' + 
                                   context.parsed.y.toFixed(3) + ' a.u.';
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    min: minX,
                    max: maxX,
                    title: {
                        display: true,
                        text: 'Wavelength (nm)',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: {
                        maxTicksLimit: 8
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    min: 0,
                    max: 1,
                    title: {
                        display: true,
                        text: 'Normalized Absorbance / PL Intensity (a.u.)',
                        font: { size: 13, weight: 'bold' }
                    },
                    ticks: {
                        stepSize: 0.2,
                        callback: function(value) {
                            return value.toFixed(1);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// ============================================================================
// RENDERING ENTRIES
// ============================================================================
function renderEntry(experiment) {
    const entry = document.createElement('div');
    entry.className = 'entry';

    const date = new Date(experiment.created_at);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const formattedDate = `${day}.${month}.${year}`;

    entry.innerHTML = `
        <div class="entry-header">
            <div>
                <h3>${experiment.title}</h3>
                <div class="entry-timestamp">${formattedDate}</div>
            </div>
            <div class="entry-actions">
                <button class="btn-download" data-id="${experiment.id}">
                    <span class="icon">💾</span>
                    <span class="text">Download Plot</span>
                </button>
                <button class="btn-edit" data-id="${experiment.id}">
                    <span class="icon">✏️</span>
                    <span class="text">Edit</span>
                </button>
                <button class="btn-delete" data-id="${experiment.id}">
                    <span class="icon">🗑️</span>
                    <span class="text">Delete</span>
                </button>
            </div>
        </div>
        <div class="chart-wrapper">
            <canvas id="spectrum-chart-${experiment.id}"></canvas>
        </div>
    `;

    entriesContainer.appendChild(entry);

    // Add event listeners for buttons
    entry.querySelector('.btn-download').addEventListener('click', () => downloadChart(experiment.id, experiment.absorption_data || [], experiment.emission_data || []));
    entry.querySelector('.btn-edit').addEventListener('click', () => editEntry(experiment));
    entry.querySelector('.btn-delete').addEventListener('click', () => deleteEntry(experiment.id));

    // Render combined chart after DOM elements are created (only if data exists)
    if ((experiment.absorption_data && experiment.absorption_data.length > 0) || 
        (experiment.emission_data && experiment.emission_data.length > 0)) {
        setTimeout(() => {
            createCombinedChart(
                `spectrum-chart-${experiment.id}`,
                experiment.absorption_data || [],
                experiment.emission_data || []
            );
        }, 0);
    } else {
        // Hide chart wrapper if no data
        entry.querySelector('.chart-wrapper').style.display = 'none';
    }
}

// ============================================================================
// DOWNLOAD CHART FUNCTION
// ============================================================================
function downloadChart(experimentId, absorptionData, emissionData) {
    const canvasId = `spectrum-chart-${experimentId}`;
    const chart = chartInstances[canvasId];
    
    if (!chart) {
        alert('No chart available to download');
        return;
    }
    
    const originalCanvas = document.getElementById(canvasId);
    
    // Always export at desktop size with high quality
    const exportWidth = 1400;
    const exportHeight = 700;
    const scaleFactor = 3;
    
    // Create temp canvas for export
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = exportWidth * scaleFactor;
    tempCanvas.height = exportHeight * scaleFactor;
    const ctx = tempCanvas.getContext('2d');
    
    // Scale for high DPI
    ctx.scale(scaleFactor, scaleFactor);
    
    // Fill white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, exportWidth, exportHeight);
    
    // Draw current chart scaled to export size
    ctx.drawImage(originalCanvas, 0, 0, exportWidth, exportHeight);
    
    // Download
    const link = document.createElement('a');
    link.download = `spectrum_${experimentId}.png`;
    link.href = tempCanvas.toDataURL('image/png', 1.0);
    link.click();
}

// ============================================================================
// DATA FETCHING & LOADING
// ============================================================================
async function loadExperiments() {
    try {
        const { data, error } = await supabaseClient
            .from('experiments')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        entriesContainer.innerHTML = '';

        if (data && data.length > 0) {
            data.forEach(experiment => {
                renderEntry(experiment);
            });
        } else {
            entriesContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 40px;">No experiments yet. Create your first entry!</p>';
        }
    } catch (error) {
        console.error('Error loading experiments:', error);
        entriesContainer.innerHTML = `<div class="error-message">Error loading experiments: ${error.message}</div>`;
    }
}

// ============================================================================
// EDIT & DELETE FUNCTIONS
// ============================================================================
let currentEditId = null;

async function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this experiment?')) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('experiments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await loadExperiments();
    } catch (error) {
        console.error('Error deleting experiment:', error);
        alert(`Error deleting experiment: ${error.message}`);
    }
}

function editEntry(experiment) {
    currentEditId = experiment.id;
    
    // Populate form with existing data
    document.getElementById('title-input').value = experiment.title;
    
    // Change modal title
    document.querySelector('.modal-header h2').textContent = 'Edit Experiment';
    
    // Change submit button text
    const submitBtn = entryForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Update Experiment';
    
    // Show modal
    openModal();
    
    // Note: CSV files can't be pre-filled, user must re-upload
    const formNote = document.createElement('div');
    formNote.className = 'info-message';
    formNote.innerHTML = '<strong>Note:</strong> Please re-upload the CSV files.';
    formNote.style.cssText = 'background: #d1ecf1; color: #0c5460; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 0.9rem;';
    
    const firstFormGroup = entryForm.querySelector('.form-group');
    firstFormGroup.parentNode.insertBefore(formNote, firstFormGroup);
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================
async function handleFormSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('title-input').value.trim();
    const absorptionFile = document.getElementById('absorption-csv').files[0];
    const emissionFile = document.getElementById('emission-csv').files[0];

    if (!title) {
        alert('Please enter a title');
        return;
    }

    try {
        // Show loading state
        const submitBtn = entryForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        // Parse CSV files if provided, otherwise use empty arrays
        let absorptionData = [];
        let emissionData = [];

        if (absorptionFile) {
            const absorptionCSV = await readFileAsText(absorptionFile);
            absorptionData = parseCSV(absorptionCSV);
        }

        if (emissionFile) {
            const emissionCSV = await readFileAsText(emissionFile);
            emissionData = parseCSV(emissionCSV);
        }

        // Insert or Update in Supabase
        let result;
        if (currentEditId) {
            // Update existing entry
            result = await supabaseClient
                .from('experiments')
                .update({
                    title: title,
                    absorption_data: absorptionData,
                    emission_data: emissionData
                })
                .eq('id', currentEditId)
                .select();
        } else {
            // Insert new entry
            result = await supabaseClient
                .from('experiments')
                .insert([
                    {
                        title: title,
                        absorption_data: absorptionData,
                        emission_data: emissionData
                    }
                ])
                .select();
        }

        const { data, error } = result;
        if (error) throw error;

        // Reset edit mode
        currentEditId = null;

        // Close modal and reload
        closeModal();
        await loadExperiments();

        // Scroll to entry
        setTimeout(() => {
            if (!currentEditId) {
                entriesContainer.lastChild?.scrollIntoView({ behavior: 'smooth' });
            }
        }, 100);

        // Restore button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

    } catch (error) {
        console.error('Error saving experiment:', error);
        alert(`Error: ${error.message}`);

        // Restore button
        const submitBtn = entryForm.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Experiment';
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    entriesContainer = document.getElementById('entries-container');
    newEntryBtn = document.getElementById('new-entry-btn');
    entryModal = document.getElementById('entry-modal');
    entryForm = document.getElementById('entry-form');
    cancelBtn = document.getElementById('cancel-btn');
    closeBtn = document.querySelector('.close');

    // Add event listeners
    newEntryBtn.addEventListener('click', openModal);
    cancelBtn.addEventListener('click', closeModal);
    closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === entryModal) {
            closeModal();
        }
    });

    // Form submission handler
    entryForm.addEventListener('submit', handleFormSubmit);

    // Check if Supabase is configured
    if (SUPABASE_URL === 'https://your-project.supabase.co' ||
        SUPABASE_ANON_KEY === 'your-anon-key-here') {
        entriesContainer.innerHTML = `
            <div class="error-message">
                <strong>⚠️ Supabase Not Configured</strong><br>
                Please update SUPABASE_URL and SUPABASE_ANON_KEY in app.js with your actual credentials.
            </div>
        `;
        newEntryBtn.disabled = true;
        return;
    }

    loadExperiments();
});
