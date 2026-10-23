import sys
import os
import subprocess
import speech_recognition as sr

def transcribe_audio(file_path, language="pt-BR"):
    wav_path = file_path + ".wav"
    try:
        # Converte qualquer formato de entrada (webm, ogg, mp4) para WAV 16kHz mono via ffmpeg
        cmd = [
            "ffmpeg", "-y", "-i", file_path,
            "-ar", "16000", "-ac", "1", "-f", "wav", wav_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data, language=language)
        return text
    except sr.UnknownValueError:
        return ""
    except Exception as e:
        sys.stderr.write(f"Erro na transcricao: {str(e)}\n")
        return ""
    finally:
        if os.path.exists(wav_path):
            try:
                os.remove(wav_path)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    file_path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 else "pt-BR"
    
    result = transcribe_audio(file_path, language)
    sys.stdout.write(result)
