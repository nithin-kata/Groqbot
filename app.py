import os
import json
from flask import Flask, render_template, request, Response, jsonify
from dotenv import load_dotenv
from groq import Groq, AuthenticationError, RateLimitError, APIConnectionError, APIError

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Known popular Groq models
POPULAR_MODELS = [
    {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B Instant",
        "description": "Ultra fast, reliable, universally available",
        "badge": "Recommended"
    },
    {
        "id": "llama3-70b-8192",
        "name": "Llama 3 70B",
        "description": "High reasoning capability, 8k context",
        "badge": "Powerful"
    },
    {
        "id": "llama3-8b-8192",
        "name": "Llama 3 8B",
        "description": "Fast and lightweight",
        "badge": "Fast"
    },
    {
        "id": "mixtral-8x7b-32768",
        "name": "Mixtral 8x7B",
        "description": "Strong general performance, 32k context",
        "badge": "Versatile"
    },
    {
        "id": "gemma2-9b-it",
        "name": "Gemma 2 9B",
        "description": "Google open model with high accuracy",
        "badge": "Accurate"
    }
]


def get_groq_client():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key or api_key == "your_groq_api_key_here":
        return None, "Groq API key is missing or set to the default placeholder. Please add your real key to the .env file."
    try:
        client = Groq(api_key=api_key)
        return client, None
    except Exception as e:
        return None, str(e)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def check_status():
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    is_configured = bool(api_key and api_key != "your_groq_api_key_here")
    default_model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
    return jsonify({
        "configured": is_configured,
        "default_model": default_model
    })


@app.route("/api/models", methods=["GET"])
def list_models():
    client, error = get_groq_client()
    default_model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

    if client:
        try:
            # Query live models from Groq using user's API key
            models_response = client.models.list()
            active_ids = {m.id for m in models_response.data}

            # First priority: check which popular models are active
            matching = [m for m in POPULAR_MODELS if m["id"] in active_ids]

            # Also include any other chat-capable models returned by Groq
            existing_ids = {m["id"] for m in matching}
            for m in sorted(models_response.data, key=lambda x: x.id):
                mid = m.id
                if mid in existing_ids:
                    continue
                # Exclude non-chat / audio / guard models
                if any(x in mid.lower() for x in ["whisper", "guard", "embed", "tts", "stt"]):
                    continue
                matching.append({
                    "id": mid,
                    "name": mid,
                    "description": "Available Groq Cloud model",
                    "badge": "Active"
                })

            if matching:
                # Ensure default_model is first if valid
                matched_default = default_model if default_model in active_ids else matching[0]["id"]
                return jsonify({
                    "models": matching,
                    "default": matched_default
                })
        except Exception as e:
            app.logger.warning(f"Failed to fetch live models: {e}")

    return jsonify({
        "models": POPULAR_MODELS,
        "default": default_model
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    client, err_msg = get_groq_client()
    if err_msg:
        return jsonify({
            "error": err_msg,
            "help": "Open the .env file in the project folder and put your Groq API key from https://console.groq.com/keys."
        }), 401

    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])
    model = data.get("model") or os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
    temperature = float(data.get("temperature", 0.7))
    stream = data.get("stream", True)
    system_prompt = data.get("system_prompt", "You are an intelligent, helpful, and friendly AI assistant powered by Groq.")

    if not messages:
        return jsonify({"error": "No messages provided in request."}), 400

    # Ensure system prompt is first message
    formatted_messages = []
    if messages and messages[0].get("role") != "system" and system_prompt:
        formatted_messages.append({"role": "system", "content": system_prompt})
    formatted_messages.extend(messages)

    if stream:
        def generate():
            try:
                try:
                    response = client.chat.completions.create(
                        model=model,
                        messages=formatted_messages,
                        temperature=temperature,
                        stream=True
                    )
                except APIError as direct_err:
                    # Automatic fallback if model not found
                    if ("model_not_found" in str(direct_err) or "does not exist" in str(direct_err)) and model != "llama-3.1-8b-instant":
                        app.logger.info(f"Model {model} unavailable, falling back to llama-3.1-8b-instant")
                        response = client.chat.completions.create(
                            model="llama-3.1-8b-instant",
                            messages=formatted_messages,
                            temperature=temperature,
                            stream=True
                        )
                    else:
                        raise direct_err

                for chunk in response:
                    delta = chunk.choices[0].delta.content if chunk.choices else ""
                    if delta:
                        yield f"data: {json.dumps({'content': delta})}\n\n"
                yield "data: [DONE]\n\n"

            except AuthenticationError:
                err = {"error": "Invalid Groq API Key. Please verify your key in the .env file."}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"
            except RateLimitError:
                err = {"error": "Groq rate limit reached. Please wait a few seconds and try again."}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"
            except APIConnectionError:
                err = {"error": "Could not connect to Groq API. Please check your network connection."}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"
            except APIError as api_err:
                err = {"error": f"Groq API error: {str(api_err)}"}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                err = {"error": f"Unexpected error: {str(e)}"}
                yield f"data: {json.dumps(err)}\n\n"
                yield "data: [DONE]\n\n"

        return Response(generate(), mimetype="text/event-stream")

    else:
        try:
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=formatted_messages,
                    temperature=temperature,
                    stream=False
                )
            except APIError as direct_err:
                if ("model_not_found" in str(direct_err) or "does not exist" in str(direct_err)) and model != "llama-3.1-8b-instant":
                    response = client.chat.completions.create(
                        model="llama-3.1-8b-instant",
                        messages=formatted_messages,
                        temperature=temperature,
                        stream=False
                    )
                else:
                    raise direct_err

            content = response.choices[0].message.content
            return jsonify({
                "message": {
                    "role": "assistant",
                    "content": content
                },
                "model": model,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0
                }
            })
        except AuthenticationError:
            return jsonify({"error": "Invalid Groq API Key. Please verify the key in your .env file."}), 401
        except RateLimitError:
            return jsonify({"error": "Groq rate limit reached."}), 429
        except APIConnectionError:
            return jsonify({"error": "Could not connect to Groq API."}), 503
        except Exception as e:
            return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "True").lower() in ["true", "1", "yes"]
    print(f"\n=======================================================")
    print(f" Groq AI Chatbot running at: http://127.0.0.1:{port}")
    print(f" Ensure your GROQ_API_KEY is configured in .env")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=debug)
