# Brigade Anti-Nuisible — état du projet (passation entre sessions Claude)

Site statique GitHub Pages, publié depuis la branche `main` de
`justin17553-boop/brigade-anti-nuisible`.
En ligne : https://justin17553-boop.github.io/brigade-anti-nuisible/

## Structure
13 pages HTML + `style.css` (styles communs) + `menu.js` (menu mobile)
+ `rdv.js` (rendez-vous : tableau de créneaux d'1 h — matin 7 h–13 h,
  après-midi 14 h–18 h, filtre matin/après-midi — devis estimatif, mode test).
Tableaux : deux semaines calendaires lundi→dimanche, jours passés grisés.
Mode nuit automatique via prefers-color-scheme dans style.css (les fonds
bleu nuit fixes utilisent --nuit-fond ; --nuit devient une couleur de
TEXTE claire en mode sombre — ne pas les confondre).
`maj.html` (privée, noindex) : installe une mise à jour préparée par
Claude — le patron y dépose un fichier maj-*.json au format
{titre, description, fichiers:[{chemin, b64}]} (chemins simples sans « / »,
contenus en base64) ; la page pousse chaque fichier via l'API GitHub avec
le jeton déjà en localStorage (clé ban_jeton_github, partagée avec
gestion.html). TOUTE future mise à jour du site doit être livrée ainsi :
générer maj-N.json, l'envoyer à l'utilisateur, qui le dépose sur
https://justin17553-boop.github.io/brigade-anti-nuisible/maj.html
+ `communes.js` (922 communes officielles des départements 17, 85, 44).
La page `demandes.html` (non référencée, noindex) affiche les demandes de
rendez-vous enregistrées en mode test (localStorage de l'appareil).

## Décisions du client à respecter
- AUCUN lien avec ELAN GESTION / TeamOP (autre activité du client).
- Prestations exactes : rats/souris, cafards, punaises de lit, nids de
  guêpes, frelons (européens et asiatiques), fourmis, puces. Rien d'autre
  (pas de pigeons, mites, poissons d'argent).
- Zone : Charente-Maritime (17), Vendée (85), Loire-Atlantique (44).
- Pas de téléphone ni d'e-mail affichés tant qu'ils n'existent pas
  (emplacements marqués « À VENIR » dans le code).

## Tarifs (dans rdv.js)
- CONFIRMÉS par le client : garantie 3 mois = 45 €, 6 mois = 80 €.
- À CONFIRMER (posés par Claude, marqués « À AJUSTER ») : grille de base
  par nuisible, +25 %/+50 % selon surface, +15 %/+35 % selon ampleur,
  frais de secteur (17 = 0 €, 85 = +20 €, 44 = +40 € — base supposée en 17),
  +40 € par passage au-delà du premier.

## À faire quand le client le demandera
1. Brancher l'envoi réel des demandes de RDV (fonction envoyerDemande()
   dans rdv.js) vers un e-mail ou un serveur — aujourd'hui mode test local.
2. Afficher téléphone/e-mail (chercher « À VENIR » dans toutes les pages).
3. Compléter mentions-legales.html (SIRET, adresse, responsable).
4. Créneaux : gérés par le patron via gestion.html (page privée) qui
   écrit disponibilites.js par l'API GitHub (jeton fine-grained stocké
   dans le navigateur du patron uniquement ; oublié et redemandé
   automatiquement si GitHub le refuse). gestion.html relit l'état par
   l'API (pas par le site, qui a du retard de build) et verrouille
   Enregistrer tant que la lecture n'a pas réussi. Côté clients,
   rendez-vous.html charge disponibilites.js avec un anti-cache par
   minute (document.write) car GitHub Pages sert en max-age=600.
5. Supprimer les fichiers Gemini_Generated_Image_*.png devenus inutiles.
