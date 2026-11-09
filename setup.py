from setuptools import setup, find_packages

setup(
    name="prompt-guard",
    version="1.0.0",
    description="AI-Powered Prompt Security Scanner and Protection Middleware",
    long_description=open("README.md").read() if open("README.md") else "",
    long_description_content_type="text/markdown",
    author="University Individual Project in AI, NLP & Cybersecurity",
    packages=find_packages(),
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: Apache Software License",
        "Topic :: Security",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "prompt-guard=cli:main",
        ],
    },
)
