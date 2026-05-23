from utils.ai_models import AVAILABLE_MODELS, generate_response, get_api_key


def choose_model() -> tuple[str, str]:
    model_items = list(AVAILABLE_MODELS.items())
    if not model_items:
        raise SystemExit("No models found. Check models.csv and try again.")

    print("Available models:")
    for index, (name, model_id) in enumerate(model_items, start=1):
        print(f"{index}. {name} ({model_id})")

    while True:
        choice = input("\nChoose a model number: ").strip()
        if choice.isdigit():
            index = int(choice)
            if 1 <= index <= len(model_items):
                return model_items[index - 1]
        print(f"Enter a number from 1 to {len(model_items)}.")


def print_key_hint() -> None:
    if get_api_key():
        return
    print(
        "\nNo API key found yet. Before sending a chat message, add "
        "OPENROUTER_API_KEY to a .env file or set it in your terminal."
    )


def main() -> None:
    print("VORTEX AI CLI")
    print("Type exit or quit to leave. Type clear to reset chat history.\n")

    model_name, model_id = choose_model()
    print(f"\nUsing {model_name}.")
    print_key_hint()

    messages: list[dict[str, str]] = []

    while True:
        prompt = input("\nYou: ").strip()
        if not prompt:
            continue
        if prompt.lower() in {"exit", "quit"}:
            print("Goodbye.")
            break
        if prompt.lower() == "clear":
            messages.clear()
            print("Chat history cleared.")
            continue

        messages.append({"role": "user", "content": prompt})
        response = generate_response(model_id, messages)
        print(f"\nAssistant: {response}")
        messages.append({"role": "assistant", "content": response})


if __name__ == "__main__":
    main()
