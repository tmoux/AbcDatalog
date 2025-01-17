package edu.harvard.seas.pl.abcdatalog.engine.bottomup.concurrent;

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
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ForkJoinPool;
import java.util.function.BiConsumer;

import edu.harvard.seas.pl.abcdatalog.ast.Clause;
import edu.harvard.seas.pl.abcdatalog.ast.PositiveAtom;
import edu.harvard.seas.pl.abcdatalog.ast.PredicateSym;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidationException;
import edu.harvard.seas.pl.abcdatalog.ast.validation.DatalogValidator;
import edu.harvard.seas.pl.abcdatalog.ast.validation.UnstratifiedProgram;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.AnnotatedAtom;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.BottomUpEngineFrame;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.ClauseEvaluator;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.EvalManager;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.SemiNaiveClauseAnnotator;
import edu.harvard.seas.pl.abcdatalog.engine.bottomup.SemiNaiveClauseAnnotator.SemiNaiveClause;
import edu.harvard.seas.pl.abcdatalog.util.Box;
import edu.harvard.seas.pl.abcdatalog.util.ExecutorServiceCounter;
import edu.harvard.seas.pl.abcdatalog.util.Utilities;
import edu.harvard.seas.pl.abcdatalog.util.datastructures.ConcurrentFactIndexer;
import edu.harvard.seas.pl.abcdatalog.util.datastructures.ConcurrentFactTrie;
import edu.harvard.seas.pl.abcdatalog.util.datastructures.FactIndexerFactory;
import edu.harvard.seas.pl.abcdatalog.util.datastructures.IndexableFactCollection;
import edu.harvard.seas.pl.abcdatalog.util.substitution.ClauseSubstitution;
import edu.harvard.seas.pl.abcdatalog.util.substitution.ConstOnlySubstitution;

/**
 * A concurrent bottom-up Datalog engine that employs a saturation algorithm
 * similar to semi-naive evaluation. It supports explicit unification. The
 * client can set the size of the work item (i.e., number of facts that are
 * bundled together during evaluation).
 *
 */

public class ConcurrentChunkedBottomUpEngine extends BottomUpEngineFrame<EvalManager> {

	public ConcurrentChunkedBottomUpEngine(int chunkSize) {
		super(new ChunkedEvalManager(chunkSize));
	}

	private static class ChunkedEvalManager implements EvalManager {
		private UnstratifiedProgram program;
		private final ConcurrentFactTrie redundancyTrie = new ConcurrentFactTrie();
		private final ConcurrentFactIndexer<Queue<PositiveAtom>> index = FactIndexerFactory
				.createConcurrentQueueFactIndexer();
		private final Map<PredicateSym, Set<SemiNaiveClause>> predToRuleMap = new HashMap<>();
		private final ExecutorServiceCounter exec = new ExecutorServiceCounter(
				new ForkJoinPool(Utilities.concurrency, ForkJoinPool.defaultForkJoinWorkerThreadFactory, null, true));
		private final int chunkSize;

		public ChunkedEvalManager(int chunkSize) {
			this.chunkSize = chunkSize;
		}

		@Override
		public void initialize(Set<Clause> program) throws DatalogValidationException {
			this.program = (new DatalogValidator()).withBinaryUnificationInRuleBody()
					.withBinaryDisunificationInRuleBody().validate(program);
		}

		@Override
		public IndexableFactCollection eval() {
			SemiNaiveClauseAnnotator annotator = new SemiNaiveClauseAnnotator(program.getIdbPredicateSyms());
			for (SemiNaiveClause cl : annotator.annotate(program.getRules())) {
				Utilities.getSetFromMap(predToRuleMap, cl.getFirstAtom().getPred()).add(cl);
			}

			for (PositiveAtom fact : program.getInitialFacts()) {
				if (redundancyTrie.add(fact)) {
					index.add(fact);
				} else {
					throw new AssertionError();
				}
			}

			// FIXME double check on visibility (i.e., whether it's okay to use
			// ArrayList)
			Queue<PositiveAtom> chunk = new ConcurrentLinkedQueue<>();
			int size = 0;
			for (PositiveAtom fact : program.getInitialFacts()) {
				chunk.add(fact);
				if (++size == chunkSize) {
					exec.submitTask(new WorkItem(chunk));
					chunk = new ConcurrentLinkedQueue<>();
					size = 0;
				}
			}
			if (size != 0) {
				exec.submitTask(new WorkItem(chunk));
			}

			exec.blockUntilFinished();
			exec.shutdownAndAwaitTermination();

			return index;
		}

		private Iterable<PositiveAtom> getFacts(AnnotatedAtom a, ConstOnlySubstitution s) {
			return index.indexInto(a.asUnannotatedAtom(), s);
		}

		private class WorkItem implements Runnable {
			private final Iterable<PositiveAtom> facts;

			public WorkItem(Iterable<PositiveAtom> facts) {
				this.facts = facts;
			}

			@Override
			public void run() {
				Box<Queue<PositiveAtom>> acc = new Box<>();
				acc.value = new ConcurrentLinkedQueue<>();
				Box<Integer> size = new Box<>();
				size.value = 0;

				BiConsumer<PositiveAtom, ClauseSubstitution> reportFact = (a, s) -> {
					if (redundancyTrie.add(a, s)) {
						PositiveAtom fact = a.applySubst(s);
						index.add(fact);
						acc.value.add(fact);
						if (++size.value == chunkSize) {
							exec.submitTask(new WorkItem(acc.value));
							acc.value = new ConcurrentLinkedQueue<>();
							size.value = 0;
						}
					}
				};

				Map<PredicateSym, List<ClauseEvaluator>> predToEvalMap = new HashMap<>();

				for (PositiveAtom fact : facts) {
					PredicateSym pred = fact.getPred();
					List<ClauseEvaluator> evals = predToEvalMap.get(pred);
					if (evals == null) {
						Iterable<SemiNaiveClause> rules = predToRuleMap.get(pred);
						if (rules == null) {
							evals = Collections.emptyList();
						} else {
							evals = new ArrayList<>();
							for (SemiNaiveClause cl : rules) {
								evals.add(new ClauseEvaluator(cl, reportFact, ChunkedEvalManager.this::getFacts));
							}
						}
						predToEvalMap.put(pred, evals);
					}

					for (ClauseEvaluator eval : evals) {
						eval.evaluate(fact);
					}
				}

				if (size.value != 0) {
					exec.submitTask(new WorkItem(acc.value));
				}

			}

		}
	}
}
