let graphData = null;
let simulation = null;
let svg = null;
let g = null;
let zoom = null;
let selectedNode = null;

async function loadGraph(excludePattern = '') {
    try {
        document.getElementById('loading').style.display = 'block';
        
        const params = new URLSearchParams();
        if (excludePattern) {
            params.append('exclude', excludePattern);
        }
        // Always use full path
        params.append('showFullPath', true);
        
        const response = await fetch(`/api/graph?${params}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        graphData = data;
        renderGraph(data);
    } catch (error) {
        console.error('Error loading graph:', error);
        alert('Failed to load dependency graph: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

function renderGraph(data) {
    const container = document.getElementById('graph-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    d3.select('#graph').selectAll('*').remove();
    
    svg = d3.select('#graph')
        .attr('width', width)
        .attr('height', height);
    
    svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#666');
    
    svg.append('defs').append('marker')
        .attr('id', 'arrow-circular')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 8)
        .attr('markerHeight', 8)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#ff6b6b');
    
    g = svg.append('g');
    
    zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
    
    svg.call(zoom);
    
    const nodeMap = new Map();
    data.nodes.forEach(node => {
        nodeMap.set(node.id, node);
    });
    
    const links = data.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        circular: edge.circular
    }));
    
    simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink(links)
            .id(d => d.id)
            .distance(100))
        .force('charge', d3.forceManyBody()
            .strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide()
            .radius(30));
    
    const link = g.append('g')
        .selectAll('line')
        .data(links)
        .enter().append('line')
        .attr('class', d => d.circular ? 'link circular' : 'link')
        .attr('marker-end', d => d.circular ? 'url(#arrow-circular)' : 'url(#arrow)');
    
    const node = g.append('g')
        .selectAll('.node')
        .data(data.nodes)
        .enter().append('g')
        .attr('class', 'node')
        .call(drag(simulation));
    
    node.append('circle')
        .attr('r', 8);
    
    node.append('text')
        .attr('dx', 12)
        .attr('dy', '.35em')
        .text(d => d.displayName || d.name);
    
    node.on('click', (event, d) => {
        event.stopPropagation();
        selectNode(d);
    });
    
    svg.on('click', () => {
        deselectNode();
    });
    
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
        
        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
    });
}

function drag(simulation) {
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }
    
    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }
    
    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
    
    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}

function selectNode(node) {
    selectedNode = node;
    
    d3.selectAll('.node')
        .classed('selected', false);
    
    d3.selectAll('.node')
        .filter(d => d.id === node.id)
        .classed('selected', true);
    
    showNodeDetails(node);
}

function deselectNode() {
    selectedNode = null;
    d3.selectAll('.node')
        .classed('selected', false);
    
    document.getElementById('sidebar').classList.add('hidden');
}

function showNodeDetails(node) {
    const sidebar = document.getElementById('sidebar');
    const details = document.getElementById('node-details');
    
    const circularDeps = [];
    if (graphData) {
        graphData.edges.forEach(edge => {
            if (edge.circular) {
                if (edge.source === node.id) {
                    circularDeps.push(edge.target);
                } else if (edge.target === node.id) {
                    circularDeps.push(edge.source);
                }
            }
        });
    }
    
    let html = `
        <div class="selected-file">${node.id}</div>
        <h3>Imports (${node.imports.length})</h3>
        <ul>
    `;
    
    node.imports.forEach(imp => {
        const isCircular = circularDeps.includes(imp);
        html += `<li class="${isCircular ? 'circular' : ''}">${imp}</li>`;
    });
    
    html += `
        </ul>
        <h3>Imported By (${node.importedBy.length})</h3>
        <ul>
    `;
    
    node.importedBy.forEach(imp => {
        const isCircular = circularDeps.includes(imp);
        html += `<li class="${isCircular ? 'circular' : ''}">${imp}</li>`;
    });
    
    html += '</ul>';
    
    if (circularDeps.length > 0) {
        html += `
            <h3 style="color: #ff6b6b;">⚠️ Circular Dependencies</h3>
            <ul>
        `;
        circularDeps.forEach(dep => {
            html += `<li class="circular">${dep}</li>`;
        });
        html += '</ul>';
    }
    
    details.innerHTML = html;
    sidebar.classList.remove('hidden');
}

function applySettings() {
    const excludePattern = document.getElementById('exclude-pattern').value;
    loadGraph(excludePattern);
}

function resetGraph() {
    document.getElementById('exclude-pattern').value = '';
    loadGraph();
}

function zoomIn() {
    svg.transition().duration(300).call(zoom.scaleBy, 1.3);
}

function zoomOut() {
    svg.transition().duration(300).call(zoom.scaleBy, 0.7);
}

function resetZoom() {
    svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
}

window.addEventListener('resize', () => {
    if (graphData) {
        renderGraph(graphData);
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    loadGraph();
});