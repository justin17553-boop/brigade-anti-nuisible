/* BRIGADE ANTI-NUISIBLE — gestion des créneaux (page privée du patron).
   Touchez les cases pour ouvrir/bloquer, puis Enregistrer : la page
   réécrit disponibilites.js dans le dépôt GitHub via l'API, avec un
   jeton stocké uniquement dans ce navigateur. */
(function () {
  var DEPOT = 'justin17553-boop/brigade-anti-nuisible';
  var FICHIER = 'disponibilites.js';
  var CLE_JETON = 'ban_jeton_github';

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
              'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var CRENEAUX = ['8 h – 10 h', '10 h – 12 h', '14 h – 16 h', '16 h – 18 h'];

  var bloques = {};          /* iso -> ['*'] ou liste de créneaux */
  var chargeOk = false;      /* l'état actuel a bien été relu depuis GitHub */
  var page = 0;
  var etat = document.getElementById('etat');
  var btnEnregistrer = document.getElementById('enregistrer');
  btnEnregistrer.disabled = true;

  /* ── les douze prochains jours ouvrés ── */
  var jours = [];
  var d = new Date();
  d.setDate(d.getDate() + 1);
  while (jours.length < 12) {
    if (d.getDay() !== 0) {
      jours.push({
        iso: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
        jourSem: JOURS[d.getDay()], num: d.getDate(), mois: MOIS[d.getMonth()]
      });
    }
    d.setDate(d.getDate() + 1);
  }

  function estBloque(iso, creneau) {
    var l = bloques[iso];
    return !!l && (l[0] === '*' || l.indexOf(creneau) !== -1);
  }

  function basculer(iso, creneau) {
    var l = bloques[iso] || [];
    if (l[0] === '*') l = CRENEAUX.slice();
    var i = l.indexOf(creneau);
    if (i === -1) l.push(creneau); else l.splice(i, 1);
    if (l.length === CRENEAUX.length) l = ['*'];
    if (l.length) bloques[iso] = l; else delete bloques[iso];
  }

  function basculerJournee(iso) {
    if (bloques[iso] && (bloques[iso][0] === '*' || bloques[iso].length === CRENEAUX.length)) {
      delete bloques[iso];
    } else {
      bloques[iso] = ['*'];
    }
  }

  var table = document.getElementById('table-gestion');
  var titreSem = document.getElementById('sem-titre');
  var btnPrec = document.getElementById('sem-prec');
  var btnSuiv = document.getElementById('sem-suiv');

  function dessiner() {
    var visibles = jours.slice(page * 6, page * 6 + 6);
    titreSem.textContent = 'Du ' + visibles[0].jourSem + ' ' + visibles[0].num + ' ' + visibles[0].mois +
                           ' au ' + visibles[visibles.length - 1].jourSem + ' ' + visibles[visibles.length - 1].num + ' ' + visibles[visibles.length - 1].mois;
    btnPrec.disabled = page === 0;
    btnSuiv.disabled = (page + 1) * 6 >= jours.length;

    table.innerHTML = '';
    var thead = document.createElement('thead');
    var tr0 = document.createElement('tr');
    tr0.appendChild(document.createElement('th'));
    visibles.forEach(function (j) {
      var th = document.createElement('th');
      th.scope = 'col';
      th.innerHTML = j.jourSem + '<b>' + j.num + '</b>' + j.mois + '<br>';
      var bj = document.createElement('button');
      bj.type = 'button';
      var tout = bloques[j.iso] && bloques[j.iso][0] === '*';
      bj.textContent = tout ? 'rouvrir' : 'bloquer';
      bj.addEventListener('click', function () { basculerJournee(j.iso); dessiner(); });
      th.appendChild(bj);
      tr0.appendChild(th);
    });
    thead.appendChild(tr0);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    CRENEAUX.forEach(function (creneau) {
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.textContent = creneau;
      tr.appendChild(td0);
      visibles.forEach(function (j) {
        var td = document.createElement('td');
        var b = document.createElement('button');
        b.type = 'button';
        var bloque = estBloque(j.iso, creneau);
        b.className = bloque ? 'cell cell-bloque' : 'cell cell-ouvert';
        b.textContent = bloque ? 'Bloqué' : 'Ouvert';
        b.addEventListener('click', function () { basculer(j.iso, creneau); dessiner(); });
        td.appendChild(b);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
  }

  btnPrec.addEventListener('click', function () { if (page > 0) { page--; dessiner(); } });
  btnSuiv.addEventListener('click', function () { if ((page + 1) * 6 < jours.length) { page++; dessiner(); } });

  /* ── charger l'état actuel — depuis l'API GitHub directement, car la
        copie servie par le site peut avoir plusieurs minutes de retard.
        Tant que ce chargement n'a pas réussi, Enregistrer reste verrouillé
        pour ne pas risquer d'écraser les blocages existants. ── */
  function message(texte, classe) {
    etat.textContent = texte;
    etat.className = 'gestion-etat' + (classe ? ' ' + classe : '');
  }

  function base64versTexte(b64) {
    var s = atob(b64.replace(/\s/g, ''));
    var octets = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) octets[i] = s.charCodeAt(i);
    return new TextDecoder('utf-8').decode(octets);
  }

  function chargementRate() {
    dessiner();
    message('Impossible de lire l’état actuel des créneaux — vérifiez la connexion internet puis rechargez la page. Enregistrer est verrouillé en attendant.', 'erreur');
  }

  fetch('https://api.github.com/repos/' + DEPOT + '/contents/' + FICHIER,
        { headers: { 'Accept': 'application/vnd.github+json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (info) {
      var m = base64versTexte(info.content).match(/var DISPONIBILITES = (\{[\s\S]*?\});/);
      if (!m) throw new Error('format inattendu');
      bloques = JSON.parse(m[1]);
      chargeOk = true;
      btnEnregistrer.disabled = false;
      dessiner();
    })
    .catch(function () { chargementRate(); });

  /* ── jeton GitHub, gardé dans ce navigateur uniquement ── */
  var blocJeton = document.getElementById('bloc-jeton');
  if (!localStorage.getItem(CLE_JETON)) blocJeton.style.display = '';
  document.getElementById('garder-jeton').addEventListener('click', function () {
    var v = document.getElementById('jeton').value.trim();
    if (v.indexOf('github_pat_') !== 0 && v.indexOf('ghp_') !== 0) {
      message('Ce jeton ne ressemble pas à un jeton GitHub.', 'erreur');
      return;
    }
    localStorage.setItem(CLE_JETON, v);
    blocJeton.style.display = 'none';
    message('Jeton enregistré sur cet appareil ✓', 'ok');
  });

  /* ── enregistrer : réécrire disponibilites.js dans le dépôt ── */
  function contenuFichier() {
    var propre = {};
    var aujourdhui = new Date();
    aujourdhui.setHours(0, 0, 0, 0);
    Object.keys(bloques).sort().forEach(function (iso) {
      var date = new Date(iso + 'T12:00:00');
      if (date >= aujourdhui) propre[iso] = bloques[iso];
    });
    return '/* BRIGADE ANTI-NUISIBLE — créneaux bloqués par le patron.\n' +
           '   Ce fichier est modifié automatiquement par la page gestion.html.\n' +
           '   Format : "AAAA-MM-JJ": ["8 h – 10 h"] ou ["*"] pour toute la journée. */\n' +
           'var DISPONIBILITES = ' + JSON.stringify(propre, null, 2) + ';\n';
  }

  function base64utf8(texte) {
    var octets = new TextEncoder().encode(texte);
    var s = '';
    for (var i = 0; i < octets.length; i++) s += String.fromCharCode(octets[i]);
    return btoa(s);
  }

  btnEnregistrer.addEventListener('click', function () {
    if (!chargeOk) return;
    var jeton = localStorage.getItem(CLE_JETON);
    if (!jeton) {
      blocJeton.style.display = '';
      blocJeton.scrollIntoView({ behavior: 'smooth' });
      message('Il faut d’abord enregistrer votre jeton (une seule fois).', 'erreur');
      return;
    }
    btnEnregistrer.disabled = true;
    message('Enregistrement…');
    var url = 'https://api.github.com/repos/' + DEPOT + '/contents/' + FICHIER;
    var entetes = {
      'Authorization': 'Bearer ' + jeton,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    fetch(url, { headers: entetes })
      .then(function (r) {
        /* un jeton expiré ou mal configuré donne 401/403, ou 404 si le
           jeton ne couvre pas le dépôt */
        if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('JETON');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (info) {
        var corps = {
          message: 'Créneaux mis à jour depuis la page de gestion',
          content: base64utf8(contenuFichier())
        };
        if (info && info.sha) corps.sha = info.sha;
        return fetch(url, { method: 'PUT', headers: entetes, body: JSON.stringify(corps) });
      })
      .then(function (r) {
        if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('JETON');
        if (!r.ok) throw new Error('HTTP ' + r.status);
        btnEnregistrer.disabled = false;
        message('Enregistré ✓ — visible par les clients d’ici quelques minutes.', 'ok');
      })
      .catch(function (e) {
        btnEnregistrer.disabled = false;
        if (e.message === 'JETON') {
          /* jeton périmé ou mal réglé : on l'oublie et on rouvre la saisie */
          localStorage.removeItem(CLE_JETON);
          blocJeton.style.display = '';
          blocJeton.scrollIntoView({ behavior: 'smooth' });
          message('Jeton refusé par GitHub (expiré ou mal réglé). Recréez-en un et collez-le ci-dessus.', 'erreur');
        } else {
          message('Échec (' + e.message + ') — vérifiez la connexion puis réessayez.', 'erreur');
        }
      });
  });
})();
