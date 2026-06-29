import os
from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA

load_dotenv()

# Load embedding model
embedding = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-MiniLM-L6-v2"
)

# Load vector DB
db = Chroma(
    persist_directory="db",
    embedding_function=embedding
)

retriever = db.as_retriever(search_kwargs={"k": 3})

# OpenAI model
llm = ChatGoogleGenerativeAI(
    model="gemini-pro",
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# RAG chain
qa = RetrievalQA.from_chain_type(
    llm=llm,
    retriever=retriever
)

print("AI/ML Assistant Ready! Type 'exit' to quit.\n")

while True:
    query = input("You: ")

    if query.lower() == "exit":
        break

    response = qa.invoke(query)

    print("\nBot:", response["result"])
    print()