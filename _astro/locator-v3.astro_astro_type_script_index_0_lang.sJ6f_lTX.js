const _={uber_eats:"uber-eats","uber-eats":"uber-eats",ubereats:"uber-eats",just_eat:"just-eat","just-eat":"just-eat",justeat:"just-eat",lieferando:"lieferando",wolt:"wolt",doordash:"doordash",deliveroo:"deliveroo",eat_ch:"eat-ch","eat-ch":"eat-ch",eatch:"eat-ch"};function S(e){const t=e.venue,s=e.dishes||[],o=[...new Set(s.flatMap(n=>n.planted_products||[]).filter(Boolean))].slice(0,4),i=t.distance_km||0,a=i<1?`${Math.round(i*1e3)}m`:`${i.toFixed(1)}km`,r=s.map(n=>n.cuisine_type).filter(Boolean);let c="restaurant";r.some(n=>/burger/i.test(n))?c="burger":r.some(n=>/bowl|poke|asian/i.test(n))?c="bowl":r.some(n=>/kebab|döner|turkish/i.test(n))&&(c="kebab");const l=(t.delivery_platforms||[]).filter(n=>n.active!==!1).map(n=>({name:n.platform.replace(/_/g," ").replace(/\b\w/g,h=>h.toUpperCase()),url:n.url,icon:_[n.platform.toLowerCase()]||"website"})),m=s.find(n=>n.image_url)?.image_url,f=r[0]||(t.type==="delivery_kitchen"?"Lieferküche":"Restaurant");return{id:t.id,name:t.name,location:t.address?.city||"",category:f,distance:a,distanceMeters:Math.round(i*1e3),products:o.length>0?o:["planted.chicken"],dishes:s.map(n=>({name:n.name,price:n.price?`${n.price.currency} ${n.price.amount.toFixed(2)}`:"",description:n.description,image:n.image_url,isVegan:n.dietary_tags?.includes("vegan"),plantedProduct:n.planted_products?.[0]})),iconType:c,heroImage:m,deliveryPartners:l}}function M(e,t,s){const o=e.dishes.slice(0,2);return`
      <article class="v3-venue-card ${t>=3?"v3-card-hidden":""}" data-venue-id="${e.id}" data-index="${t}">
        <div class="v3-card-header">
          <div class="v3-venue-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
              <path d="M7 2v20"/>
              <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
            </svg>
          </div>
          <div class="v3-venue-info">
            <h3 class="v3-venue-name">${e.name}</h3>
            <div class="v3-venue-meta">
              <span>${e.location}</span>
              <span>${e.category}</span>
            </div>
          </div>
          <span class="v3-venue-distance">${e.distance}</span>
        </div>

        <div class="v3-product-tags">
          ${e.products.map(a=>`<span class="v3-product-tag">${a}</span>`).join("")}
        </div>

        <div class="v3-dishes-list">
          ${o.map(a=>`
            <div class="v3-dish-item">
              <span class="v3-dish-name">
                ${a.name}
                ${a.isVegan?`<span class="v3-dish-badge">${s.vegan}</span>`:""}
              </span>
              <span class="v3-dish-price">${a.price}</span>
            </div>
          `).join("")}
        </div>

        <footer class="v3-card-footer">
          <button class="v3-view-details-btn" type="button">
            ${s.viewAllDishes}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <span class="v3-dish-count">${e.dishes.length} ${s.dishes}</span>
        </footer>
      </article>
    `}const C={8e3:{lat:47.3769,lng:8.5417},8001:{lat:47.3686,lng:8.5391},8004:{lat:47.3776,lng:8.5244},8005:{lat:47.3904,lng:8.5182},8008:{lat:47.3531,lng:8.557},8048:{lat:47.3842,lng:8.4831},8304:{lat:47.415,lng:8.595},6e3:{lat:47.0502,lng:8.3093},3e3:{lat:46.948,lng:7.4474},4e3:{lat:47.5596,lng:7.5886},1e3:{lat:46.5197,lng:6.6323},1200:{lat:46.2044,lng:6.1432},10115:{lat:52.52,lng:13.405},10117:{lat:52.517,lng:13.3889},80331:{lat:48.1351,lng:11.582},80335:{lat:48.1392,lng:11.5651},20095:{lat:53.5511,lng:9.9937},50667:{lat:50.9375,lng:6.9603},60311:{lat:50.1109,lng:8.6821},1010:{lat:48.2082,lng:16.3738},1020:{lat:48.2167,lng:16.4}};async function x(e,t){if(C[e])return C[e];const o={ch:"Switzerland",de:"Germany",at:"Austria",uk:"United Kingdom",nl:"Netherlands",fr:"France",it:"Italy",es:"Spain"}[t]||t;try{const i=`https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(e)}&country=${encodeURIComponent(o)}&format=json&limit=1`,a=await fetch(i,{headers:{"User-Agent":"PlantedWebsite/1.0"}});if(!a.ok)return null;const r=await a.json();return r.length===0?null:{lat:parseFloat(r[0].lat),lng:parseFloat(r[0].lon)}}catch{return null}}function V(){const e=document.getElementById("v3CardGrid"),t=document.querySelector(".v3-main-content");if(!t||!e)return;e.style.display="none";const s=`
      <div class="v3-card-grid v3-skeleton-grid" id="v3SkeletonGrid">
        ${Array.from({length:3}).map(()=>`
          <div class="v3-venue-card v3-skeleton-card">
            <div class="v3-card-header">
              <div class="v3-venue-icon v3-skeleton-icon"></div>
              <div class="v3-venue-info" style="flex: 1;">
                <div class="v3-skeleton-text v3-skeleton-title"></div>
                <div class="v3-skeleton-text v3-skeleton-meta"></div>
              </div>
              <div class="v3-skeleton-text v3-skeleton-distance"></div>
            </div>
            <div class="v3-product-tags">
              <span class="v3-skeleton-tag"></span>
              <span class="v3-skeleton-tag"></span>
            </div>
            <div class="v3-dishes-list">
              <div class="v3-skeleton-text v3-skeleton-dish"></div>
              <div class="v3-skeleton-text v3-skeleton-dish"></div>
            </div>
            <div class="v3-card-footer">
              <div class="v3-skeleton-text v3-skeleton-button"></div>
              <div class="v3-skeleton-text v3-skeleton-count"></div>
            </div>
          </div>
        `).join("")}
      </div>
    `,o=document.createElement("div");o.innerHTML=s,t.insertBefore(o.firstElementChild,e)}function E(){const e=document.getElementById("v3SkeletonGrid");e&&e.remove();const t=document.getElementById("v3CardGrid");t&&(t.style.display="")}async function T(){const e=window.__v3Config;if(!e)return;document.getElementById("v3CardGrid"),document.querySelector(".v3-main-content");const t=document.querySelector(".v3-header-title"),s=document.querySelector(".v3-results-count");document.getElementById("v3LoadMore"),document.getElementById("v3LoadMoreCount"),V();try{let{lat:o,lng:i,apiBaseUrl:a,zip:r,countryCode:c}=e;if((!o||!i)&&r){console.log("[V3] Missing coordinates, geocoding ZIP:",r);const p=await x(r,c||"ch");p&&(o=String(p.lat),i=String(p.lng),console.log("[V3] Geocoded to:",o,i))}if(!o||!i)throw new Error("Missing coordinates - could not geocode ZIP");const l=`${a}/nearby?lat=${o}&lng=${i}&radius_km=10&type=restaurant&limit=20`;console.log("[V3] Fetching venues from:",l);const m=await fetch(l);if(!m.ok)throw new Error(`API error: ${m.status}`);const f=await m.json();console.log("[V3] Received",f.total,"venues");const n=f.results.map(S);v=n,d=[...n],window.__v3Venues=n,E(),t&&(t.textContent=e.translations.headerTitle.replace("{count}",String(n.length)));const h=n.reduce((p,I)=>p+I.dishes.length,0);s&&(s.textContent=e.translations.dishesFound.replace("{count}",String(h))),$()}catch(o){console.error("[V3] Error loading venues:",o),E();const i=document.querySelector(".v3-main-content");if(i){const a=document.createElement("div");a.className="v3-error",a.innerHTML=`
          <div class="v3-error-icon">⚠️</div>
          <p>${e.translations.errorLoading}</p>
          <p style="font-size: 0.875rem; color: #999; margin-top: 0.5rem;">${o.message}</p>
        `,i.insertBefore(a,i.firstChild?.nextSibling||null)}}}let v=[],d=[],u=0;const B=3;let g=!1,y=null;function b(){if(g||d.length-u<=0)return;g=!0;const t=window.__v3Config,s=document.getElementById("v3CardGrid");if(!s){g=!1;return}const o=d.slice(u,u+B);o.forEach((i,a)=>{const r=M(i,u+a,t.translations),c=document.createElement("div");c.innerHTML=r.trim();const l=c.firstElementChild;l.style.opacity="0",l.style.transform="translateY(20px)",l.classList.remove("v3-card-hidden"),s.appendChild(l),setTimeout(()=>{l.style.transition="opacity 0.3s ease, transform 0.3s ease",l.style.opacity="1",l.style.transform="translateY(0)"},a*100)}),u+=o.length,k(),setTimeout(()=>{g=!1},o.length*100+100)}function k(){const e=document.getElementById("v3LoadMore"),t=document.getElementById("v3LoadMoreCount");if(document.getElementById("v3LoadMoreBtn"),!e||!t)return;const s=d.length-u;s>0?(e.style.display="",t.textContent=`(+${s} mehr)`):e.style.display="none"}function G(e){switch(e){case"all":d=[...v];break;case"distance-500":d=v.filter(t=>(t.distanceMeters||0)<=500);break;case"distance-1000":d=v.filter(t=>(t.distanceMeters||0)<=1e3);break;case"top-rated":d=[...v];break;default:if(e.startsWith("product-")){const t=e.replace("product-","");d=v.filter(s=>s.products.includes(t))}else d=[...v]}u=0,$()}function $(){const e=window.__v3Config,t=document.getElementById("v3CardGrid"),s=document.getElementById("v3NoResults");if(!t||!e)return;if(t.innerHTML="",d.length===0){t.style.display="none",s&&(s.style.display=""),k();return}t.style.display="",s&&(s.style.display="none");const o=d.slice(0,B);o.forEach((i,a)=>{const r=M(i,a,e.translations),c=document.createElement("div");c.innerHTML=r.trim();const l=c.firstElementChild;l.classList.remove("v3-card-hidden"),l.style.animationDelay=`${.05*(a+1)}s`,t.appendChild(l)}),u=o.length,k()}function j(){const e=()=>{y&&clearTimeout(y),y=window.setTimeout(()=>{const t=document.getElementById("v3LoadMore");if(!t||t.style.display==="none")return;t.getBoundingClientRect().top<window.innerHeight+200&&!g&&b()},150)};window.addEventListener("scroll",e,{passive:!0})}function H(){const e=document.querySelectorAll(".v3-filter-chip");e.forEach(t=>{t.addEventListener("click",()=>{e.forEach(o=>o.classList.remove("active")),t.classList.add("active");const s=t.getAttribute("data-filter")||"all";G(s)})})}function D(){document.getElementById("v3LoadMoreBtn")?.addEventListener("click",()=>{b()})}let w=!1;function L(){w||(w=!0,T(),H(),D(),j())}document.addEventListener("DOMContentLoaded",L);document.addEventListener("astro:page-load",()=>{w=!1,L()});
