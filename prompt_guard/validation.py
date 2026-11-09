"""
Input validation module for PromptGuard Python middleware.
Fulfills Part 5 of the Master Project Blueprint.
"""

from typing import Tuple, Optional


def validate_input(user_input: any, max_length: int = 8000) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Validates input type, null characters, emptiness and length.
    Returns (is_valid, error_code, error_message).
    """
    if user_input is None:
        return False, "EMPTY_INPUT", "Prompt input cannot be None or null."

    if not isinstance(user_input, str):
        return False, "INVALID_TYPE", f"Expected prompt to be a string, received {type(user_input).__name__}."

    trimmed = user_input.strip()
    if len(trimmed) == 0:
        return False, "EMPTY_INPUT", "Prompt cannot be empty or solely whitespace."

    if "\x00" in user_input:
        return False, "CONTAINS_NULL_BYTES", "Prompt contains dangerous binary null bytes (\\x00)."

    if len(user_input) > max_length:
        return (
            False,
            "EXCEEDS_LENGTH_LIMIT",
            f"Prompt length ({len(user_input)} chars) exceeds maximum configured limit of {max_length}.",
        )

    return True, None, None
