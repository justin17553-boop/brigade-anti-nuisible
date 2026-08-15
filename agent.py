#!/usr/bin/env python3
"""
Mini-agent CLI — pour tester la puissance d'un agent IA sur ta machine.

Lancement :
    export ANTHROPIC_API_KEY=sk-ant-...
    python3 agent.py            # mode confirmation (recommandé)
    python3 agent.py --yolo     # exécute sans demander (à tes risques)

L'agent dispose de 3 outils : run_bash, run_python, write_file.
Il boucle tout seul jusqu'à ce que la tâche soit terminée.
"""

import os
import subprocess
import sys

import anthropic

MODEL = "claude-opus-5"       # mets "claude-fable-5" pour la puissance max
MAX_TOKENS = 16000            # la réflexion est active par défaut : garde de la marge
EFFORT = "high"               # low | medium | high | xhigh | max (plus bas = plus rapide/moins cher)
MAX_TOURS = 25                # garde-fou anti boucle infinie
CONFIRMATION = "--yolo" not in sys.argv

# Couleurs ANSI
VIOLET, CYAN, JAUNE, ROUGE, GRIS, GRAS, FIN = (
    "\033[95m", "\033[96m", "\033[93m", "\033[91m", "\033[90m", "\033[1m", "\033[0m",
)

SYSTEM = (
    "Tu es un agent autonome qui tourne sur la machine de l'utilisateur (macOS ou Linux). "
    "Tu accomplis les tâches demandées en utilisant tes outils, étape par étape. "
    "Règles : avance par petites étapes vérifiables, vérifie tes résultats après chaque action, "
    "ne détruis jamais de données sans demander, et termine toujours par un court résumé "
    "en français de ce que tu as fait."
)

TOOLS = [
    {
        "name": "run_bash",
        "description": (
            "Exécute une commande shell sur la machine et retourne stdout + stderr. "
            "Sert à explorer les fichiers, installer des paquets, lancer des programmes, "
            "ouvrir des fichiers (open/xdg-open), etc."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "La commande à exécuter"}
            },
            "required": ["command"],
        },
    },
    {
        "name": "run_python",
        "description": (
            "Exécute un script Python complet et retourne sa sortie. "
            "Idéal pour les calculs, l'analyse de données, le traitement de texte ou d'images."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Code Python complet à exécuter"}
            },
            "required": ["code"],
        },
    },
    {
        "name": "write_file",
        "description": "Écrit du contenu dans un fichier (le crée ou l'écrase).",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "Chemin du fichier"},
                "content": {"type": "string", "description": "Contenu complet du fichier"},
            },
            "required": ["path", "content"],
        },
    },
]


def executer_outil(nom: str, entree: dict) -> str:
    """Exécute réellement l'outil demandé par le modèle et retourne le résultat."""
    try:
        if nom == "run_bash":
            r = subprocess.run(
                entree["command"], shell=True, capture_output=True, text=True, timeout=120
            )
            return (r.stdout + r.stderr)[:8000] or "(aucune sortie)"

        if nom == "run_python":
            r = subprocess.run(
                [sys.executable, "-c", entree["code"]],
                capture_output=True, text=True, timeout=120,
            )
            return (r.stdout + r.stderr)[:8000] or "(aucune sortie)"

        if nom == "write_file":
            dossier = os.path.dirname(entree["path"])
            if dossier:
                os.makedirs(dossier, exist_ok=True)
            with open(entree["path"], "w", encoding="utf-8") as f:
                f.write(entree["content"])
            return f"Fichier écrit : {entree['path']} ({len(entree['content'])} caractères)"

        return f"Outil inconnu : {nom}"

    except subprocess.TimeoutExpired:
        return "Erreur : délai dépassé (120 s)"
    except Exception as e:
        return f"Erreur : {e}"


def demander_confirmation(nom: str, entree: dict) -> bool:
    """Montre ce que l'agent veut faire et demande l'accord (Entrée = oui)."""
    if not CONFIRMATION:
        return True
    apercu = entree.get("command") or entree.get("code") or entree.get("path", "")
    if len(apercu) > 400:
        apercu = apercu[:400] + "…"
    print(f"{JAUNE}⚠ L'agent veut exécuter [{nom}] :{FIN}\n{GRIS}{apercu}{FIN}")
    reponse = input(f"{JAUNE}Autoriser ? (Entrée = oui, n = non) {FIN}").strip().lower()
    return reponse not in ("n", "non", "no")


def boucle_agent(client: anthropic.Anthropic, messages: list) -> None:
    """Le cœur : le modèle décide, on exécute, on lui renvoie le résultat. Et on boucle."""
    for tour in range(1, MAX_TOURS + 1):
        try:
            reponse = client.messages.create(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM,
                tools=TOOLS,
                thinking={"type": "adaptive", "display": "summarized"},
                output_config={"effort": EFFORT},
                # Met en cache tout l'historique déjà envoyé : dans une boucle
                # d'agent, on renvoie la conversation entière à chaque tour.
                cache_control={"type": "ephemeral"},
                messages=messages,
            )
        except anthropic.APIError as e:
            print(f"{ROUGE}Erreur API : {e}{FIN}")
            return

        # Affiche le raisonnement / texte du modèle
        for bloc in reponse.content:
            if bloc.type == "thinking" and bloc.thinking.strip():
                print(f"\n{GRIS}{bloc.thinking}{FIN}")
            elif bloc.type == "text" and bloc.text.strip():
                print(f"\n{VIOLET}{bloc.text}{FIN}")

        # On garde la réponse de l'assistant dans l'historique, quoi qu'il arrive :
        # sinon l'agent perd ses propres réponses d'une tâche à l'autre.
        messages.append({"role": "assistant", "content": reponse.content})

        if reponse.stop_reason == "refusal":
            categorie = getattr(reponse.stop_details, "category", None)
            print(f"{ROUGE}Le modèle a refusé cette demande"
                  f"{f' ({categorie})' if categorie else ''}.{FIN}")
            return

        if reponse.stop_reason == "max_tokens":
            print(f"{ROUGE}Réponse coupée : augmente MAX_TOKENS ou baisse EFFORT.{FIN}")
            return

        # Plus d'appel d'outil = tâche terminée
        if reponse.stop_reason != "tool_use":
            return

        # On exécute chaque outil demandé et on prépare les résultats
        resultats = []
        for bloc in reponse.content:
            if bloc.type != "tool_use":
                continue
            print(f"\n{CYAN}{GRAS}▶ Outil : {bloc.name}{FIN}")
            if demander_confirmation(bloc.name, bloc.input):
                sortie = executer_outil(bloc.name, bloc.input)
            else:
                sortie = "L'utilisateur a refusé cette exécution. Propose une alternative."
            affichage = sortie if len(sortie) <= 600 else sortie[:600] + "…"
            print(f"{GRIS}{affichage}{FIN}")
            resultats.append(
                {"type": "tool_result", "tool_use_id": bloc.id, "content": sortie}
            )

        # On renvoie les résultats au modèle → tour suivant de la boucle
        messages.append({"role": "user", "content": resultats})

    print(f"{ROUGE}Limite de {MAX_TOURS} tours atteinte, arrêt de la boucle.{FIN}")


def main() -> None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(f"{ROUGE}Clé API manquante.{FIN}")
        print("Crée une clé sur https://console.anthropic.com puis :")
        print("    export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    client = anthropic.Anthropic()
    mode = "confirmation ON" if CONFIRMATION else "YOLO (aucune confirmation)"
    print(f"{GRAS}🤖 Mini-agent — modèle {MODEL} — {mode}{FIN}")
    print(f"{GRIS}Tape ta tâche puis Entrée. 'q' pour quitter. "
          f"L'historique est conservé entre les tâches.{FIN}\n")

    messages: list = []
    while True:
        try:
            tache = input(f"{GRAS}Toi ▸ {FIN}").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not tache:
            continue
        if tache.lower() in ("q", "quit", "exit"):
            break
        messages.append({"role": "user", "content": tache})
        boucle_agent(client, messages)
        print()


if __name__ == "__main__":
    main()
