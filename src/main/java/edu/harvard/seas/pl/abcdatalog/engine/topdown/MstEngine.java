package edu.harvard.seas.pl.abcdatalog.engine.topdown;

/*-
 * #%L
 * AbcDatalog
 * %%
 * Copyright (C) 2016 - 2021 President and Fellows of Harvard College
 * %%
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 * 
 * 3. Neither the name of the President and Fellows of Harvard College nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 * #L%
 */

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Stack;

import edu.harvard.seas.pl.abcdatalog.ast.Clause;
import edu.harvard.seas.pl.abcdatalog.ast.Constant;
import edu.harvard.seas.pl.abcdatalog.ast.PositiveAtom;
import edu.harvard.seas.pl.abcdatalog.ast.PredicateSym;
import edu.harvard.seas.pl.abcdatalog.ast.Premise;
import edu.harvard.seas.pl.abcdatalog.ast.Term;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidationException;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidator;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidator.ValidClause;
import edu.harvard.seas.pl.abcdatalog.ast.validation.UnstratifiedProgram;
import edu.harvard.seas.pl.abcdatalog.ast.visitors.HeadVisitor;
import edu.harvard.seas.pl.abcdatalog.engine.DatalogEngine;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.concurrent.ConcurrentBottomUpEngine;
import edu.harvard.seas.pl.abcdatalog.util.Utilities;

/**
 * A Datalog evaluation engine that uses the magic set transformation technique.
 * Given a query, this engine rewrites the program in such a way that it can
 * evaluate the query efficiently using a bottom-up engine.
 * 
 * <b>NOTE:</b> predicate symbols that use '%' might not work with this engine.
 *
 */

public class MstEngine implements DatalogEngine {
	// FIXME The predicate symbol issue noted in the Javadocs is awkward.
	
	/**
	 * Maps an EDB predicate to its facts.
	 */
	private final Map<PredicateSym, Set<PositiveAtom>> edbFacts = new HashMap<>();
	/**
	 * Maps an IDB predicate to the rules that define it.
	 */
	private final Map<PredicateSym, Set<ValidClause>> idbRules = new HashMap<>();

	@Override
	public void init(Set<Clause> program) throws DatalogValidationException {
		UnstratifiedProgram prog = (new DatalogValidator()).validate(program, true);

		HeadVisitor<Void, PredicateSym> getHeadPred = new HeadVisitor<Void, PredicateSym>() {

			@Override
			public PredicateSym visit(PositiveAtom atom, Void state) {
				return atom.getPred();
			}

		};
		for (ValidClause c : prog.getRules()) {
			PredicateSym pred = c.getHead().accept(getHeadPred, null);
			Utilities.getSetFromMap(idbRules, pred).add(c);
		}
		for (PositiveAtom fact : prog.getInitialFacts()) {
			Utilities.getSetFromMap(edbFacts, fact.getPred()).add(fact);
		}
	}

	@Override
	public Set<PositiveAtom> query(PositiveAtom q) {
		// Is the query for EDB facts?
		Set<PositiveAtom> facts = this.edbFacts.get(q.getPred());
		if (facts != null) {
			Set<PositiveAtom> result = new LinkedHashSet<>();
			for (PositiveAtom fact : facts) {
				if (q.unify(fact) != null) {
					result.add(fact);
				}
			}
			return result;
		}

		// Figure out adornment from query.
		List<Boolean> adornment = new ArrayList<>();
		List<Term> input = new ArrayList<>();
		for (Term t : q.getArgs()) {
			if (t instanceof Constant) {
				adornment.add(true);
				input.add(t);
			} else {
				adornment.add(false);
			}
		}

		// Generate rewritten program.
		AdornedPredicateSym adornedQueryPred = new AdornedPredicateSym(q.getPred(), adornment);
		Set<Clause> magicProgram = genMagicProgram(adornedQueryPred, input);

		// Initialize a semi-naive evaluation engine with the rewritten program
		// and process query results.
		DatalogEngine engine = new ConcurrentBottomUpEngine();
		try {
			engine.init(magicProgram);
		} catch (DatalogValidationException e) {
			throw new AssertionError();
		}
		PositiveAtom newQuery = createAtom(adornedQueryPred, q.getArgs());
		Set<PositiveAtom> result = new LinkedHashSet<>();
		for (PositiveAtom r : engine.query(newQuery)) {
			// Need to translate atoms from rewritten program to original one.
			result.add(PositiveAtom.create(q.getPred(), r.getArgs()));
		}
		return result;
	}

	/**
	 * Given the adorned predicate for a query and the initial input "tuple",
	 * returns a rewritten program that allows for efficient evaluation of that
	 * query using a bottom-up engine.
	 * 
	 * @param adornedQueryPred
	 *            adorned predicate for query
	 * @param input
	 *            input (i.e. constants that appear in query)
	 * @return rewritten program
	 */
	private Set<Clause> genMagicProgram(AdornedPredicateSym adornedQueryPred, List<Term> input) {
		assert adornedQueryPred.getBound() == input.size();

		// Add rule to magic program for initial input from query.
		Set<Clause> magicProgram = new LinkedHashSet<>();
		// TODO this is clunky
		Term[] inputAsArray = new Term[input.size()];
		inputAsArray = input.toArray(inputAsArray);
		magicProgram.add(createInputRule(adornedQueryPred, inputAsArray, new ArrayList<>()));

		// Track which predicates we need to process and which ones already have
		// been processed.
		Stack<AdornedPredicateSym> predsToProcess = new Stack<>();
		predsToProcess.push(adornedQueryPred);
		Set<AdornedPredicateSym> predsInProcess = new LinkedHashSet<>();
		predsInProcess.add(adornedQueryPred);

		while (!predsToProcess.isEmpty()) {
			AdornedPredicateSym p = predsToProcess.pop();

			// If it's an EDB predicate, no action needs to be taken.
			if (this.edbFacts.containsKey(p.getUnadorned())) {
				continue;
			}

			int ruleNo = 0;
			Set<ValidClause> rules = this.idbRules.get(p.getUnadorned());
			// If there are no rules, the predicate isn't recognized.
			if (rules == null) {
				continue;
			}

			// Process each rule in turn, creating a new set of "magic" rules.
			for (ValidClause rule : rules) {
				AdornedClause adornedRule = AdornedClause.fromClause(p.getAdornment(), rule);

				// Handle special case of explicit IDB fact (i.e. body-less
				// clause with an IDB predicate).
				if (adornedRule.getBody().isEmpty()) {
					Clause idbFact = createRule(adornedRule.getHead().getPred(), adornedRule.getHead().getArgs(),
							new ArrayList<>());
					magicProgram.add(idbFact);
					continue;
				}

				QsqTemplate templ = new QsqTemplate(adornedRule);

				// Skip rule for first supplementary relation by just treating
				// the input relation as the first supplementary relation.
				PositiveAtom prevSup = createInputAtom(p, getBoundArgs(adornedRule.getHead()));

				// Loop through remaining supplementary relations.
				int last = templ.size();
				for (int i = 1; i < last; ++i) {
					AdornedAtom a = adornedRule.getBody().get(i - 1);
					if (!predsInProcess.contains(a.getPred())) {
						predsToProcess.push(a.getPred());
						predsInProcess.add(a.getPred());
					}

					HeadVisitor<Void, PositiveAtom> getHead = new HeadVisitor<Void, PositiveAtom>() {

						@Override
						public PositiveAtom visit(PositiveAtom atom, Void state) {
							return atom;
						}

					};
					// Head of rule is the current supplemental relation.
					PositiveAtom head;
					if (i < last - 1) {
						// TODO clunky
						Term[] attr = new Term[templ.get(i).attributes.size()];
						attr = templ.get(i).attributes.toArray(attr);
						head = createSupAtom(p, ruleNo, i, attr);
					} else {
						// Skip rule defining the last supplementary relation by
						// replacing it with a rule defining the predicate that
						// we are processing.
						head = createAtom(p, rule.getHead().accept(getHead, null).getArgs());
					}

					// Body of rule is the previous supplemental relation and
					// the current atom.
					List<Premise> body = new ArrayList<>();
					PositiveAtom atom = createAtom(a.getPred(), a.getArgs());
					body.add(prevSup);
					body.add(atom);
					magicProgram.add(new Clause(head, body));

					// If the current atom is an IDB predicate, we must define a
					// new rule passing in input from previous supplementary
					// relation.
					if (this.idbRules.containsKey(a.getPred().getUnadorned())) {
						List<Premise> inputRuleBody = new ArrayList<>();
						inputRuleBody.add(prevSup);
						Clause inputRule = createInputRule(a.getPred(), getBoundArgs(a), inputRuleBody);
						magicProgram.add(inputRule);
					}

					prevSup = head;
				}

				++ruleNo;
			}
		}

		// Add EDB facts to the rewritten program.
		for (Set<PositiveAtom> set : this.edbFacts.values()) {
			for (PositiveAtom fact : set) {
				magicProgram.add(new Clause(fact, Collections.emptyList()));
			}
		}

		return magicProgram;
	}

	/**
	 * Returns the bound terms of an adorned atom.
	 * 
	 * @param a
	 *            adorned atom
	 * @return bound terms
	 */
	private Term[] getBoundArgs(AdornedAtom a) {
		List<Term> boundTerms = new ArrayList<>();
		for (int j = 0; j < a.getPred().getArity(); ++j) {
			if (a.getPred().getAdornment().get(j)) {
				boundTerms.add(a.getArgs()[j]);
			}
		}
		Term[] r = new Term[boundTerms.size()];
		return boundTerms.toArray(r);
	}

	/**
	 * Constructs an atom from a predicate name and a list of arguments.
	 * 
	 * @param predName
	 *            predicate name
	 * @param args
	 *            arguments
	 * @return atom
	 */
	private PositiveAtom constructAtom(String predName, Term[] args) {
		return PositiveAtom.create(PredicateSym.create(predName, args.length), args);
	}

	/**
	 * Generates the name for a relation for an adorned predicate. E.g. the
	 * adorned predicate {@code p<bbf>} is translated as p_bbf.
	 * 
	 * @param p
	 *            adorned predicate
	 * @return name
	 */
	private String genName(AdornedPredicateSym p) {
		String s = p.getSym();
		// Add adornment information if it's an IDB predicate.
		if (idbRules.containsKey(p.getUnadorned())) {
			if (!p.getAdornment().isEmpty()) {
				s = "%" + s + "_";
				for (boolean b : p.getAdornment()) {
					s += (b) ? "b" : "f";
				}
			}
		}
		return s;
	}

	/**
	 * Generates the name for an input relation for an adorned predicate. E.g.
	 * the adorned predicate {@code p<bbf>} is translated as input_p_bbf.
	 * 
	 * @param p
	 *            adorned predicate
	 * @return name
	 */
	private String genInputName(AdornedPredicateSym p) {
		return "%input" + genName(p);
	}

	/**
	 * Generates the name for the supNo supplementary relation for the ruleNo
	 * rule defining the adorned predicate p. E.g. the third supplementary
	 * relation for the first rule defining the adorned predicate {@code p<bbf>}
	 * is translated as p_bbf_r1_sup3.
	 * 
	 * @param p
	 *            adorned predicate
	 * @param ruleNo
	 *            rule number
	 * @param supNo
	 *            supplementary relation number
	 * @return rule
	 */
	private String genSupName(AdornedPredicateSym p, int ruleNo, int supNo) {
		return genName(p) + "_r" + ruleNo + "_sup" + supNo;
	}

	/**
	 * Creates a properly named atom representing a relation for the adorned
	 * predicate pred that has the terms specified in args.
	 * 
	 * @param pred
	 *            adorned predicate
	 * @param args
	 *            arguments for atom
	 * @return atom
	 */
	private PositiveAtom createAtom(AdornedPredicateSym pred, Term[] args) {
		if (idbRules.containsKey(pred.getUnadorned())) {
			return constructAtom(genName(pred), args);
		}
		return PositiveAtom.create(pred.getUnadorned(), args);
	}

	/**
	 * Creates a properly named atom representing an input relation for the
	 * adorned predicate pred that has the terms specified in args.
	 * 
	 * @param pred
	 *            adorned predicate
	 * @param args
	 *            arguments for atom
	 * @return atom
	 */
	private PositiveAtom createInputAtom(AdornedPredicateSym pred, Term[] args) {
		return constructAtom(genInputName(pred), args);
	}

	/**
	 * Creates a properly named atom representing the supNo supplementary
	 * relation for the ruleNo rule defining the adorned predicate pred that has
	 * the terms specified in args.
	 * 
	 * @param pred
	 *            adorned predicate
	 * @param ruleNo
	 *            rule number
	 * @param supNo
	 *            supplementary relation number
	 * @param args
	 *            arguments for atom
	 * @return atom
	 */
	private PositiveAtom createSupAtom(AdornedPredicateSym pred, int ruleNo, int supNo, Term[] args) {
		return constructAtom(genSupName(pred, ruleNo, supNo), args);
	}

	/**
	 * Creates a rule where the head is a properly named atom representing a
	 * relation for the adorned predicate headPred that has the terms specified
	 * in headArgs.
	 * 
	 * @param headPred
	 *            predicate for head of rule
	 * @param headArgs
	 *            arguments for head of rule
	 * @param body
	 *            body of rule
	 * @return rule
	 */
	private Clause createRule(AdornedPredicateSym headPred, Term[] headArgs, List<Premise> body) {
		return new Clause(createAtom(headPred, headArgs), body);
	}

	/**
	 * Creates a rule where the head is a properly named atom representing an
	 * input relation for the adorned predicate headPred that has the terms
	 * specified in headArgs.
	 * 
	 * @param headPred
	 *            predicate for head of rule
	 * @param headArgs
	 *            arguments for head of rule
	 * @param body
	 *            body of rule
	 * @return rule
	 */
	private Clause createInputRule(AdornedPredicateSym headPred, Term[] headArgs, List<Premise> body) {
		PositiveAtom head = createInputAtom(headPred, headArgs);
		return new Clause(head, body);
	}
}
